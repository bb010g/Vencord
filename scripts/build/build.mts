#!/usr/bin/env tsx
/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import esbuild from "esbuild";
import { readdir } from "fs/promises";
import { join } from "path";

import { BUILD_TIMESTAMP, buildOpts, exists, globPlugins, IS_DEV, IS_REPORTER, IS_STANDALONE, IS_UPDATER_DISABLED, makeBuildPromise, makeContextPromise, resolvePluginName, VERSION, watch, watchOpts } from "./common.mjs";

const defines: esbuild.CommonOptions["define"] = {
    IS_STANDALONE: JSON.stringify(IS_STANDALONE),
    IS_DEV: JSON.stringify(IS_DEV),
    IS_REPORTER: JSON.stringify(IS_REPORTER),
    IS_UPDATER_DISABLED: JSON.stringify(IS_UPDATER_DISABLED),
    IS_WEB: JSON.stringify(false),
    IS_EXTENSION: JSON.stringify(false),
    VERSION: JSON.stringify(VERSION),
    BUILD_TIMESTAMP: JSON.stringify(BUILD_TIMESTAMP),
};

if (defines.IS_STANDALONE === "false")
    // If this is a local build (not standalone), optimize
    // for the specific platform we're on
    defines["process.platform"] = JSON.stringify(process.platform);

const nodeBuildOpts: esbuild.BuildOptions = {
    ...buildOpts,
    format: "cjs",
    platform: "node",
    target: ["esnext"],
    external: ["electron", "original-fs", "~pluginNatives", ...(buildOpts.external ?? [])],
    define: defines
};

const sourceMapFooter = (s: string) => watch ? "" : `//# sourceMappingURL=vencord://${s}.js.map`;
const sourcemap = watch ? "inline" : "external";

const globNativesPlugin: esbuild.Plugin = {
    name: "glob-natives-plugin",
    setup: build => {
        const filter = /^~pluginNatives$/;
        build.onResolve({ filter }, args => {
            return {
                namespace: "import-natives",
                path: args.path
            };
        });

        build.onLoad({ filter, namespace: "import-natives" }, async () => {
            const pluginDirs = ["plugins", "userplugins"];
            let code = "";
            let natives = "\n";
            let i = 0;
            for (const dir of pluginDirs) {
                const dirPath = join("src", dir);
                if (!await exists(dirPath)) continue;
                const plugins = await readdir(dirPath, { withFileTypes: true });
                for (const file of plugins) {
                    const fileName = file.name;
                    const nativePath = join(dirPath, fileName, "native.ts");
                    const indexNativePath = join(dirPath, fileName, "native/index.ts");

                    if (!(await exists(nativePath)) && !(await exists(indexNativePath)))
                        continue;

                    const pluginName = await resolvePluginName(dirPath, file);

                    const mod = `p${i}`;
                    code += `import * as ${mod} from "./${dir}/${fileName}/native";\n`;
                    natives += `${JSON.stringify(pluginName)}:${mod},\n`;
                    i++;
                }
            }
            code += `export default {${natives}};`;
            return {
                contents: code,
                resolveDir: "./src"
            };
        });
    }
};

const buildOptions: esbuild.BuildOptions[] = [
    // Discord Desktop main & renderer & preload
    {
        ...nodeBuildOpts,
        entryPoints: ["src/main/index.ts"],
        outfile: "dist/patcher.js",
        footer: { js: "//# sourceURL=VencordPatcher\n" + sourceMapFooter("patcher") },
        sourcemap,
        define: {
            ...defines,
            IS_DISCORD_DESKTOP: JSON.stringify(true),
            IS_VESKTOP: JSON.stringify(false)
        },
        plugins: [
            ...(nodeBuildOpts.plugins ?? []),
            globNativesPlugin
        ]
    },
    {
        ...buildOpts,
        entryPoints: ["src/Vencord.ts"],
        outfile: "dist/renderer.js",
        format: "iife",
        target: ["esnext"],
        footer: { js: "//# sourceURL=VencordRenderer\n" + sourceMapFooter("renderer") },
        globalName: "Vencord",
        sourcemap,
        plugins: [
            globPlugins("discordDesktop"),
            ...(buildOpts.plugins ?? [])
        ],
        define: {
            ...defines,
            IS_DISCORD_DESKTOP: JSON.stringify(true),
            IS_VESKTOP: JSON.stringify(false)
        }
    },
    {
        ...nodeBuildOpts,
        entryPoints: ["src/preload.ts"],
        outfile: "dist/preload.js",
        footer: { js: "//# sourceURL=VencordPreload\n" + sourceMapFooter("preload") },
        sourcemap,
        define: {
            ...defines,
            IS_DISCORD_DESKTOP: JSON.stringify(true),
            IS_VESKTOP: JSON.stringify(false)
        }
    },

    // Vencord Desktop main & renderer & preload
    {
        ...nodeBuildOpts,
        entryPoints: ["src/main/index.ts"],
        outfile: "dist/vencordDesktopMain.js",
        footer: { js: "//# sourceURL=VencordDesktopMain\n" + sourceMapFooter("vencordDesktopMain") },
        sourcemap,
        define: {
            ...defines,
            IS_DISCORD_DESKTOP: JSON.stringify(false),
            IS_VESKTOP: JSON.stringify(true)
        },
        plugins: [
            ...(nodeBuildOpts.plugins ?? []),
            globNativesPlugin
        ]
    },
    {
        ...buildOpts,
        entryPoints: ["src/Vencord.ts"],
        outfile: "dist/vencordDesktopRenderer.js",
        format: "iife",
        target: ["esnext"],
        footer: { js: "//# sourceURL=VencordDesktopRenderer\n" + sourceMapFooter("vencordDesktopRenderer") },
        globalName: "Vencord",
        sourcemap,
        plugins: [
            globPlugins("vencordDesktop"),
            ...(buildOpts.plugins ?? [])
        ],
        define: {
            ...defines,
            IS_DISCORD_DESKTOP: JSON.stringify(false),
            IS_VESKTOP: JSON.stringify(true)
        }
    },
    {
        ...nodeBuildOpts,
        entryPoints: ["src/preload.ts"],
        outfile: "dist/vencordDesktopPreload.js",
        footer: { js: "//# sourceURL=VencordPreload\n" + sourceMapFooter("vencordDesktopPreload") },
        sourcemap,
        define: {
            ...defines,
            IS_DISCORD_DESKTOP: JSON.stringify(false),
            IS_VESKTOP: JSON.stringify(true)
        }
    },
];

const contextPromises = buildOptions.map(makeContextPromise);
await Promise.all(contextPromises.map(async (contextPromise, buildIndex) => {
    return makeBuildPromise(await contextPromise, buildOptions[buildIndex], watchOpts);
}));

if (!watch) {
    await Promise.all(contextPromises.map(async contextPromise => {
        return (await contextPromise).dispose();
    }));
}