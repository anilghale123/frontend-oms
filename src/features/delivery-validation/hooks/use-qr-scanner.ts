import { useEffect, useEffectEvent, useState, type RefObject } from "react";

/** Why the camera couldn't start. */
export type CameraError = "insecure" | "unsupported" | "denied" | "not_found" | "in_use" | "failed";

export type QrScannerState =
	{ status: "starting" } | { status: "scanning" } | { status: "error"; error: CameraError };

/** How often a camera frame is checked for a QR code. */
const SCAN_INTERVAL_MS = 120;
/** Frames are cropped to the square the rider sees and scaled down to this many pixels a side:
 * plenty for a QR on a phone screen, and quick to decode. */
const MAX_FRAME_SIZE = 480;
/** The rear camera on phones; laptops fall back to the camera they have. */
const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
	audio: false,
	video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
};

type DecodeFrame = (frame: ImageData) => Promise<string | null>;

/** The part of the Shape Detection API used here. TypeScript's DOM types don't include it yet. */
interface BarcodeDetectorApi {
	new (options: { formats: string[] }): {
		detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]>;
	};
	getSupportedFormats(): Promise<string[]>;
}

/** The browser's own QR detector where it has one (Chrome on Android and macOS), else jsQR,
 * loaded only when a scan starts. */
async function createDecoder(): Promise<DecodeFrame> {
	const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorApi }).BarcodeDetector;
	if (Detector && (await Detector.getSupportedFormats()).includes("qr_code")) {
		const detector = new Detector({ formats: ["qr_code"] });
		return async (frame) => (await detector.detect(frame))[0]?.rawValue ?? null;
	}
	const { default: jsQR } = await import("jsqr");
	return async ({ data, width, height }) =>
		jsQR(data, width, height, { inversionAttempts: "dontInvert" })?.data ?? null;
}

/** Why this page can't ask for the camera at all, or null when it can. */
function cameraBlocker(): CameraError | null {
	// Browsers only offer the camera to https pages (and localhost).
	if (!window.isSecureContext) return "insecure";
	if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
	return null;
}

function toCameraError(error: unknown): CameraError {
	switch (error instanceof DOMException ? error.name : "") {
		case "NotAllowedError":
		case "SecurityError":
			return "denied";
		case "NotFoundError":
		case "OverconstrainedError":
			return "not_found";
		case "NotReadableError":
			return "in_use";
		default:
			return "failed";
	}
}

/** Copies the centre square of the video (what the rider sees) into the canvas, scaled down. */
function readFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null {
	const { videoWidth: width, videoHeight: height } = video;
	const side = Math.min(width, height);
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!side || !context) return null;
	const size = Math.min(side, MAX_FRAME_SIZE);
	if (canvas.width !== size) {
		canvas.width = size;
		canvas.height = size;
	}
	context.drawImage(video, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size);
	return context.getImageData(0, 0, size, size);
}

export interface UseQrScannerOptions {
	/** The `<video>` that shows the camera. Render it muted and `playsInline`. */
	videoRef: RefObject<HTMLVideoElement | null>;
	/** The camera runs only while this is true. Turning it off releases the camera at once. */
	enabled: boolean;
	/** Called with the text of each QR code read, several times a second while one stays in view. */
	onDecode: (text: string) => void;
}

/**
 * Opens the camera into `videoRef` and reads QR codes from it until disabled or unmounted.
 * Returns the camera state, and `retry` to ask for the camera again after an error.
 */
export function useQrScanner({ videoRef, enabled, onDecode }: UseQrScannerOptions) {
	const [state, setState] = useState<QrScannerState>({ status: "starting" });
	/** Bumped by `retry` to run the camera effect again. */
	const [attempt, setAttempt] = useState(0);
	const handleDecode = useEffectEvent(onDecode);

	useEffect(() => {
		const video = videoRef.current;
		if (!enabled || !video) return;
		let cancelled = false;
		let stream: MediaStream | null = null;
		let timer: number | undefined;
		const canvas = document.createElement("canvas");

		const scan = async (decode: DecodeFrame) => {
			const frame = readFrame(video, canvas);
			const text = frame ? await decode(frame).catch(() => null) : null;
			if (cancelled) return;
			if (text) handleDecode(text);
			timer = window.setTimeout(() => void scan(decode), SCAN_INTERVAL_MS);
		};

		const start = async () => {
			try {
				const decode = await createDecoder();
				if (cancelled) return;
				const blocker = cameraBlocker();
				if (blocker) {
					setState({ status: "error", error: blocker });
					return;
				}
				const media = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
				if (cancelled) {
					media.getTracks().forEach((track) => track.stop());
					return;
				}
				stream = media;
				video.srcObject = media;
				await video.play();
				if (cancelled) return;
				setState({ status: "scanning" });
				void scan(decode);
			} catch (error) {
				if (!cancelled) setState({ status: "error", error: toCameraError(error) });
			}
		};

		void start();
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
			stream?.getTracks().forEach((track) => track.stop());
			video.srcObject = null;
		};
	}, [enabled, attempt, videoRef]);

	function retry() {
		setState({ status: "starting" });
		setAttempt((count) => count + 1);
	}

	return { state, retry };
}
