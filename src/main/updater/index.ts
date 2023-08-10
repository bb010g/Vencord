/*
 * Vencord, a Discord client mod
 * Copyright (c) 2022 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

if (!IS_UPDATER_DISABLED)
    import(IS_STANDALONE ? "./http" : "./git");
