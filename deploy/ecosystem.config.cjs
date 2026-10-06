/**
 * pm2 process file for the two backends on the VPS.
 *
 *   pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
 *
 * Paths assume the repos are cloned to /srv. Each backend reads its own `.env` / `.env.local`
 * from its folder, so no secret lives in this file.
 */
module.exports = {
	apps: [
		{
			name: "oms-backend",
			cwd: "/srv/oms-backend",
			// `next start` serves the build made by `npm run build`. Not `next dev`.
			script: "node_modules/next/dist/bin/next",
			args: "start --port 3001",
			env: { NODE_ENV: "production" },
			max_memory_restart: "350M",
		},
		{
			name: "fonepoints-backend",
			cwd: "/srv/fonepoints-backend",
			// Node runs the TypeScript directly; `.env` is loaded by Node itself.
			script: "src/index.ts",
			interpreter: "node",
			node_args: "--env-file=.env",
			env: { NODE_ENV: "production" },
			max_memory_restart: "150M",
		},
	],
};
