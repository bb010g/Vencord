/*
 * Vencord, a Discord client mod
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "oneko",
    description: "cat follow mouse (real)",
    // Listing adryd here because this literally just evals her script
    authors: [Devs.Ven, Devs.adryd],

    start() {
        fetch("https://raw.githubusercontent.com/adryd325/oneko.js/5977144dce83e4d71af1de005d16e38eebeb7b72/oneko.js")
            .then(x => x.text())
            .then(s => s.replace("./oneko.gif", "https://raw.githubusercontent.com/adryd325/oneko.js/14bab15a755d0e35cd4ae19c931d96d306f99f42/oneko.gif"))
            .then(eval);
    },

    stop() {
        clearInterval(window.onekoInterval);
        delete window.onekoInterval;
        document.getElementById("oneko")?.remove();
    }
});
