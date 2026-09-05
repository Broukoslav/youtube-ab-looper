// ==UserScript==
// @name         YouTube A/B Looper + Clips (Safe)
// @namespace    youtube-ab-looper
// @version      3.3.3
// @description  A/B loop, rychlost a bezpečné ukládání vlastních YouTube klipů
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'youtube-ab-my-clips';
    const PENDING_KEY = 'youtube-ab-pending-clip';

    const MIN_SPEED = 0.25;
    const MAX_SPEED = 2.0;
    const SPEED_STEP = 0.05;

    let video = null;
    let A = null;
    let B = null;
    let looping = false;
    let speed = 1;

    let lastVideoId = null;
    let pendingApplyTimer = null;

    // --------------------------------------------------
    // VIDEO
    // --------------------------------------------------

    function getVideo() {
        const currentVideo =
            document.querySelector('video');

        if (currentVideo !== video) {
            video = currentVideo;

            if (video) {
                video.playbackRate = speed;
            }
        }

        return video;
    }

    // --------------------------------------------------
    // ČAS
    // --------------------------------------------------

    function timeString(t) {
        if (
            t === null ||
            !Number.isFinite(t)
        ) {
            return '--:--.---';
        }

        const m = Math.floor(t / 60);
        const s = t % 60;

        return (
            String(m).padStart(2, '0') +
            ':' +
            s.toFixed(3).padStart(6, '0')
        );
    }

    // --------------------------------------------------
    // VIDEO ID
    // --------------------------------------------------

    function getVideoId() {
        try {
            const url =
                new URL(window.location.href);

            const id =
                url.searchParams.get('v');

            if (
                typeof id !== 'string' ||
                !/^[a-zA-Z0-9_-]{6,20}$/.test(id)
            ) {
                return null;
            }

            return id;

        } catch {
            return null;
        }
    }

    // --------------------------------------------------
    // TITULEK
    // --------------------------------------------------

    function getVideoTitle() {
        const title =
            document.querySelector(
                'h1.ytd-watch-metadata'
            );

        if (!title) {
            return 'YouTube video';
        }

        const text =
            title.textContent.trim();

        if (!text) {
            return 'YouTube video';
        }

        return text.slice(0, 200);
    }

    // --------------------------------------------------
    // STORAGE
    // --------------------------------------------------

    function isValidClip(clip) {
        if (
            !clip ||
            typeof clip !== 'object'
        ) {
            return false;
        }

        if (
            typeof clip.name !== 'string' ||
            clip.name.trim().length === 0 ||
            clip.name.length > 200
        ) {
            return false;
        }

        if (
            typeof clip.videoId !== 'string' ||
            !/^[a-zA-Z0-9_-]{6,20}$/.test(
                clip.videoId
            )
        ) {
            return false;
        }

        if (
            typeof clip.A !== 'number' ||
            !Number.isFinite(clip.A) ||
            clip.A < 0
        ) {
            return false;
        }

        if (
            typeof clip.B !== 'number' ||
            !Number.isFinite(clip.B) ||
            clip.B <= clip.A
        ) {
            return false;
        }

        if (
            typeof clip.speed !== 'number' ||
            !Number.isFinite(clip.speed) ||
            clip.speed < MIN_SPEED ||
            clip.speed > MAX_SPEED
        ) {
            return false;
        }

        return true;
    }

    function getClips() {
        try {
            const raw =
                localStorage.getItem(
                    STORAGE_KEY
                );

            if (!raw) {
                return [];
            }

            const parsed =
                JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return parsed.filter(
                isValidClip
            );

        } catch {
            return [];
        }
    }

    function saveClips(clips) {
        if (!Array.isArray(clips)) {
            return false;
        }

        const safeClips =
            clips.filter(
                isValidClip
            );

        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    safeClips
                )
            );

            return true;

        } catch (e) {
            console.error(
                '[YouTube A/B Looper] Nelze uložit klipy:',
                e
            );

            alert(
                'Klipy se nepodařilo uložit.'
            );

            return false;
        }
    }

    // --------------------------------------------------
    // UI
    // --------------------------------------------------

    function update() {
        const a =
            document.getElementById('ab-A');

        const b =
            document.getElementById('ab-B');

        const l =
            document.getElementById('ab-loop');

        const sp =
            document.getElementById('ab-speed');

        if (
            !a ||
            !b ||
            !l ||
            !sp
        ) {
            return;
        }

        a.textContent =
            'A: ' + timeString(A);

        b.textContent =
            'B: ' + timeString(B);

        l.textContent =
            looping
                ? 'LOOP ON'
                : 'LOOP OFF';

        l.style.background =
            looping
                ? '#16803c'
                : '#555';

        sp.textContent =
            speed.toFixed(2) + '×';

        if (video) {
            video.playbackRate =
                speed;
        }
    }

    // --------------------------------------------------
    // A / B
    // --------------------------------------------------

    function setA() {
        if (!getVideo()) {
            return;
        }

        A =
            video.currentTime;

        if (
            !Number.isFinite(A) ||
            A < 0
        ) {
            A = null;
            update();
            return;
        }

        if (
            B !== null &&
            B <= A
        ) {
            B = null;
        }

        looping = false;

        update();
    }

    function setB() {
        if (!getVideo()) {
            return;
        }

        const newB =
            video.currentTime;

        if (
            !Number.isFinite(newB) ||
            newB < 0
        ) {
            return;
        }

        if (
            A !== null &&
            newB <= A
        ) {
            B = null;

            alert(
                'B musí být později než A.'
            );

            update();
            return;
        }

        B = newB;
        looping = false;

        update();
    }

    function toggleLoop() {
        if (
            A === null ||
            B === null
        ) {
            alert(
                'Nejdřív nastav A a B.'
            );
            return;
        }

        if (!getVideo()) {
            return;
        }

        looping = !looping;

        if (looping) {
            video.currentTime = A;

            const p =
                video.play();

            if (
                p &&
                typeof p.catch ===
                    'function'
            ) {
                p.catch(() => {});
            }
        }

        update();
    }

    function clearAB() {
        A = null;
        B = null;
        looping = false;

        update();
    }

    // --------------------------------------------------
    // SPEED
    // --------------------------------------------------

    function changeSpeed(delta) {
        speed =
            Math.max(
                MIN_SPEED,
                Math.min(
                    MAX_SPEED,
                    speed + delta
                )
            );

        speed =
            Math.round(
                speed * 100
            ) / 100;

        update();
    }

    // --------------------------------------------------
    // BUTTON
    // --------------------------------------------------

    function createButton(
        id,
        text
    ) {
        const button =
            document.createElement(
                'button'
            );

        button.id = id;
        button.type = 'button';
        button.textContent = text;

        Object.assign(
            button.style,
            {
                border: '0',
                borderRadius: '4px',
                padding: '5px 7px',
                background: '#555',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '10px',
                lineHeight: '1.2',
                minHeight: '24px'
            }
        );

        return button;
    }

    // --------------------------------------------------
    // SAVE CLIP
    // --------------------------------------------------

    function saveCurrentClip() {
        if (
            A === null ||
            B === null
        ) {
            alert(
                'Nejdřív nastav A a B.'
            );
            return;
        }

        const videoId =
            getVideoId();

        if (!videoId) {
            alert(
                'Tlačítko ULOŽIT KLIP použij na stránce konkrétního YouTube videa.'
            );
            return;
        }

        const name =
            prompt(
                'Název klipu:',
                getVideoTitle()
            );

        if (name === null) {
            return;
        }

        const cleanName =
            name.trim();

        if (!cleanName) {
            return;
        }

        const clip = {
            name:
                cleanName.slice(
                    0,
                    200
                ),

            videoId:
                videoId,

            A: A,
            B: B,
            speed: speed
        };

        if (!isValidClip(clip)) {
            alert(
                'Klip obsahuje neplatná data.'
            );
            return;
        }

        const clips =
            getClips();

        clips.push(clip);

        if (
            saveClips(clips)
        ) {
            renderClips();

            alert(
                'Klip uložen.'
            );
        }
    }

    // --------------------------------------------------
    // OPEN CLIP
    // --------------------------------------------------

    function openClip(clip) {
        if (!isValidClip(clip)) {
            alert(
                'Klip obsahuje neplatná data.'
            );
            return;
        }

        /*
         * ZÁSADNÍ OPRAVA 3.3.3:
         *
         * Už zde NEKONTROLUJEME, zda se podařilo
         * zjistit aktuální video.
         *
         * ID cílového videa už máme bezpečně
         * uložené v klipu.
         */

        const currentId =
            getVideoId();

        if (
            currentId ===
            clip.videoId
        ) {
            waitAndApplyClip(
                clip
            );

            return;
        }

        /*
         * Cílové video je jiné.
         * Uložíme klip do sessionStorage
         * a necháme YouTube přejít na cílové video.
         */

        try {
            sessionStorage.setItem(
                PENDING_KEY,
                JSON.stringify(clip)
            );
        } catch (e) {
            console.error(
                '[YouTube A/B Looper] SessionStorage chyba:',
                e
            );

            alert(
                'Nepodařilo se připravit klip.'
            );

            return;
        }

        const targetUrl =
            'https://www.youtube.com/watch?v=' +
            encodeURIComponent(
                clip.videoId
            );

        /*
         * Použijeme location.href.
         * Tím funguje jak klasická navigace,
         * tak případ, kdy YouTube aktuálně není
         * na watch stránce.
         */
        window.location.href =
            targetUrl;
    }

    // --------------------------------------------------
    // WAIT + APPLY
    // --------------------------------------------------

    function waitAndApplyClip(
        clip
    ) {
        if (
            pendingApplyTimer
        ) {
            clearInterval(
                pendingApplyTimer
            );

            pendingApplyTimer =
                null;
        }

        let attempts = 0;

        pendingApplyTimer =
            setInterval(
                () => {
                    attempts++;

                    const currentId =
                        getVideoId();

                    const currentVideo =
                        document.querySelector(
                            'video'
                        );

                    if (
                        currentId ===
                            clip.videoId &&
                        currentVideo
                    ) {
                        /*
                         * Máme správné video.
                         * Počkáme ještě na metadata,
                         * aby byla známá duration.
                         */

                        if (
                            !Number.isFinite(
                                currentVideo.duration
                            )
                        ) {
                            if (
                                attempts >=
                                150
                            ) {
                                clearInterval(
                                    pendingApplyTimer
                                );

                                pendingApplyTimer =
                                    null;
                            }

                            return;
                        }

                        clearInterval(
                            pendingApplyTimer
                        );

                        pendingApplyTimer =
                            null;

                        video =
                            currentVideo;

                        applyClip(
                            clip
                        );

                        return;
                    }

                    /*
                     * 15 sekund je dostatečný čas
                     * pro načtení YouTube videa.
                     */

                    if (
                        attempts >=
                        150
                    ) {
                        clearInterval(
                            pendingApplyTimer
                        );

                        pendingApplyTimer =
                            null;

                        console.warn(
                            '[YouTube A/B Looper] Timeout při čekání na video.'
                        );
                    }

                },
                100
            );
    }

    function applyClip(clip) {
        if (!isValidClip(clip)) {
            return;
        }

        const currentId =
            getVideoId();

        if (
            currentId !==
            clip.videoId
        ) {
            return;
        }

        const currentVideo =
            document.querySelector(
                'video'
            );

        if (!currentVideo) {
            return;
        }

        video =
            currentVideo;

        A = clip.A;
        B = clip.B;
        speed = clip.speed;
        looping = false;

        /*
         * Kontrola délky videa.
         */

        if (
            Number.isFinite(
                video.duration
            )
        ) {
            if (
                A >=
                video.duration
            ) {
                alert(
                    'Pozice A je mimo délku tohoto videa.'
                );

                A = null;
                B = null;

                update();

                return;
            }

            if (
                B >
                video.duration
            ) {
                B =
                    video.duration;
            }

            if (
                B <= A
            ) {
                alert(
                    'Klip má neplatný časový rozsah pro toto video.'
                );

                A = null;
                B = null;

                update();

                return;
            }
        }

        video.playbackRate =
            speed;

        video.currentTime =
            A;

        looping = true;

        const p =
            video.play();

        if (
            p &&
            typeof p.catch ===
                'function'
        ) {
            p.catch(() => {});
        }

        update();
    }

    // --------------------------------------------------
    // PENDING CLIP
    // --------------------------------------------------

    function getPendingClip() {
        try {
            const raw =
                sessionStorage.getItem(
                    PENDING_KEY
                );

            if (!raw) {
                return null;
            }

            const clip =
                JSON.parse(raw);

            if (
                !isValidClip(clip)
            ) {
                sessionStorage.removeItem(
                    PENDING_KEY
                );

                return null;
            }

            return clip;

        } catch {
            return null;
        }
    }

    function consumePendingClip() {
        const clip =
            getPendingClip();

        if (!clip) {
            return;
        }

        const currentId =
            getVideoId();

        if (
            currentId !==
            clip.videoId
        ) {
            return;
        }

        /*
         * Odstraníme pending až nyní,
         * kdy víme, že jsme na správném videu.
         */

        try {
            sessionStorage.removeItem(
                PENDING_KEY
            );
        } catch {}

        waitAndApplyClip(
            clip
        );
    }

    // --------------------------------------------------
    // YOUTUBE SPA NAVIGATION
    // --------------------------------------------------

    function handleNavigation() {
        const newId =
            getVideoId();

        if (
            newId ===
            lastVideoId
        ) {
            /*
             * Nemusí jít o změnu videa.
             * Ale pokud čeká pending klip,
             * zkusíme ho.
             */

            const pending =
                getPendingClip();

            if (
                pending &&
                pending.videoId ===
                    newId
            ) {
                consumePendingClip();
            }

            return;
        }

        lastVideoId =
            newId;

        /*
         * Nové video = nový A/B stav.
         */

        A = null;
        B = null;
        looping = false;
        video = null;

        update();
        renderClips();

        /*
         * Zkontrolujeme čekající klip.
         */

        const pending =
            getPendingClip();

        if (
            pending &&
            pending.videoId ===
                newId
        ) {
            consumePendingClip();
        }
    }

    function installNavigationHandlers() {
        lastVideoId =
            getVideoId();

        /*
         * YouTube vlastní SPA event.
         *
         * yt-navigate-finish je používán
         * právě pro dokončenou interní navigaci.
         */

        document.addEventListener(
            'yt-navigate-finish',
            () => {
                setTimeout(
                    handleNavigation,
                    50
                );
            },
            true
        );

        /*
         * Další YouTube event.
         */

        document.addEventListener(
            'yt-page-data-updated',
            () => {
                setTimeout(
                    handleNavigation,
                    100
                );
            },
            true
        );

        /*
         * Back / Forward.
         */

        window.addEventListener(
            'popstate',
            () => {
                setTimeout(
                    handleNavigation,
                    50
                );
            },
            true
        );

        /*
         * URL polling jako záložní mechanismus.
         *
         * Nezávisí na tom, jestli konkrétní
         * YouTube event v dané chvíli proběhne.
         */

        let previousUrl =
            window.location.href;

        setInterval(
            () => {
                const currentUrl =
                    window.location.href;

                if (
                    currentUrl !==
                    previousUrl
                ) {
                    previousUrl =
                        currentUrl;

                    handleNavigation();
                }
            },
            250
        );
    }

    // --------------------------------------------------
    // CLIP EDIT
    // --------------------------------------------------

    function editClip(index) {
        const clips =
            getClips();

        if (
            index < 0 ||
            index >= clips.length
        ) {
            return;
        }

        const clip =
            clips[index];

        const name =
            prompt(
                'Název klipu:',
                clip.name
            );

        if (name === null) {
            return;
        }

        const cleanName =
            name.trim();

        if (!cleanName) {
            alert(
                'Název nesmí být prázdný.'
            );
            return;
        }

        const aInput =
            prompt(
                'Začátek A v sekundách:',
                clip.A.toFixed(3)
            );

        if (aInput === null) {
            return;
        }

        const bInput =
            prompt(
                'Konec B v sekundách:',
                clip.B.toFixed(3)
            );

        if (bInput === null) {
            return;
        }

        const speedInput =
            prompt(
                'Rychlost (0.25–2.00):',
                clip.speed.toFixed(2)
            );

        if (speedInput === null) {
            return;
        }

        const edited = {
            name:
                cleanName.slice(
                    0,
                    200
                ),

            videoId:
                clip.videoId,

            A:
                Number(aInput),

            B:
                Number(bInput),

            speed:
                Number(speedInput)
        };

        if (
            !isValidClip(edited)
        ) {
            alert(
                'Neplatné hodnoty.\n\n' +
                'A musí být >= 0.\n' +
                'B musí být větší než A.\n' +
                'Rychlost musí být 0.25–2.00.'
            );

            return;
        }

        clips[index] =
            edited;

        if (
            saveClips(clips)
        ) {
            renderClips();
        }
    }

    // --------------------------------------------------
    // DUPLICATE
    // --------------------------------------------------

    function duplicateClip(index) {
        const clips =
            getClips();

        if (
            index < 0 ||
            index >= clips.length
        ) {
            return;
        }

        const original =
            clips[index];

        const copy = {
            name:
                (
                    original.name +
                    ' – kopie'
                ).slice(0, 200),

            videoId:
                original.videoId,

            A:
                original.A,

            B:
                original.B,

            speed:
                original.speed
        };

        clips.splice(
            index + 1,
            0,
            copy
        );

        if (
            saveClips(clips)
        ) {
            renderClips();
        }
    }

    // --------------------------------------------------
    // CLIPS UI
    // --------------------------------------------------

    function renderClips() {
        const list =
            document.getElementById(
                'ab-clips-list'
            );

        if (!list) {
            return;
        }

        while (
            list.firstChild
        ) {
            list.removeChild(
                list.firstChild
            );
        }

        const clips =
            getClips();

        if (
            clips.length === 0
        ) {
            const empty =
                document.createElement(
                    'div'
                );

            empty.textContent =
                'Žádné uložené klipy';

            Object.assign(
                empty.style,
                {
                    color: '#aaa',
                    padding: '5px 0',
                    fontSize: '10px'
                }
            );

            list.appendChild(
                empty
            );

            return;
        }

        clips.forEach(
            (clip, index) => {
                const row =
                    document.createElement(
                        'div'
                    );

                Object.assign(
                    row.style,
                    {
                        display: 'grid',
                        gridTemplateColumns:
                            'minmax(0,1fr) auto auto auto',
                        alignItems:
                            'center',
                        gap: '3px',
                        marginBottom:
                            '3px'
                    }
                );

                const open =
                    createButton(
                        'clip-' + index,
                        clip.name
                    );

                open.style.width =
                    '100%';

                open.style.textAlign =
                    'left';

                open.style.fontWeight =
                    'normal';

                open.style.overflow =
                    'hidden';

                open.style.textOverflow =
                    'ellipsis';

                open.style.whiteSpace =
                    'nowrap';

                open.title =
                    timeString(clip.A) +
                    ' → ' +
                    timeString(clip.B) +
                    ' | ' +
                    clip.speed.toFixed(2) +
                    '×';

                const edit =
                    createButton(
                        'edit-' + index,
                        '✏️'
                    );

                edit.title =
                    'Upravit klip';

                const duplicate =
                    createButton(
                        'duplicate-' + index,
                        '⧉'
                    );

                duplicate.title =
                    'Duplikovat klip';

                const del =
                    createButton(
                        'delete-' + index,
                        '×'
                    );

                del.title =
                    'Smazat klip';

                del.style.background =
                    '#8b2020';

                open.addEventListener(
                    'click',
                    () =>
                        openClip(clip)
                );

                edit.addEventListener(
                    'click',
                    () =>
                        editClip(index)
                );

                duplicate.addEventListener(
                    'click',
                    () =>
                        duplicateClip(index)
                );

                del.addEventListener(
                    'click',
                    () => {
                        if (
                            !confirm(
                                'Smazat klip "' +
                                clip.name +
                                '"?'
                            )
                        ) {
                            return;
                        }

                        const current =
                            getClips();

                        current.splice(
                            index,
                            1
                        );

                        if (
                            saveClips(
                                current
                            )
                        ) {
                            renderClips();
                        }
                    }
                );

                row.append(
                    open,
                    edit,
                    duplicate,
                    del
                );

                list.appendChild(
                    row
                );
            }
        );
    }

    // --------------------------------------------------
    // EXPORT
    // --------------------------------------------------

    function exportClips() {
        const clips =
            getClips();

        if (
            clips.length === 0
        ) {
            alert(
                'Nemáš žádné klipy k exportu.'
            );
            return;
        }

        const data = {
            format:
                'youtube-ab-looper',

            version: 1,

            exportedAt:
                new Date().toISOString(),

            clips:
                clips
        };

        const blob =
            new Blob(
                [
                    JSON.stringify(
                        data,
                        null,
                        2
                    )
                ],
                {
                    type:
                        'application/json'
                }
            );

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                'a'
            );

        link.href = url;

        link.download =
            'youtube-ab-looper-clips.json';

        document.body.appendChild(
            link
        );

        link.click();

        link.remove();

        setTimeout(
            () =>
                URL.revokeObjectURL(
                    url
                ),
            1000
        );
    }

    // --------------------------------------------------
    // IMPORT
    // --------------------------------------------------

    function importClips() {
        const input =
            document.createElement(
                'input'
            );

        input.type = 'file';

        input.accept =
            '.json,application/json';

        input.addEventListener(
            'change',
            () => {
                const file =
                    input.files &&
                    input.files[0];

                if (!file) {
                    return;
                }

                const reader =
                    new FileReader();

                reader.onload =
                    () => {
                        let data;

                        try {
                            data =
                                JSON.parse(
                                    reader.result
                                );
                        } catch {
                            alert(
                                'Soubor není platný JSON.'
                            );
                            return;
                        }

                        let imported;

                        if (
                            data &&
                            typeof data ===
                                'object' &&
                            Array.isArray(
                                data.clips
                            )
                        ) {
                            imported =
                                data.clips;
                        } else if (
                            Array.isArray(
                                data
                            )
                        ) {
                            imported =
                                data;
                        } else {
                            alert(
                                'Soubor neobsahuje platný seznam klipů.'
                            );
                            return;
                        }

                        const valid =
                            imported.filter(
                                isValidClip
                            );

                        if (
                            valid.length === 0
                        ) {
                            alert(
                                'V souboru nebyl nalezen žádný platný klip.'
                            );
                            return;
                        }

                        const existing =
                            getClips();

                        const replace =
                            confirm(
                                'Nalezeno ' +
                                valid.length +
                                ' platných klipů.\n\n' +
                                'OK = nahradit současnou knihovnu\n' +
                                'Zrušit = přidat k současné knihovně'
                            );

                        const result =
                            replace
                                ? valid
                                : existing.concat(
                                      valid
                                  );

                        if (
                            saveClips(
                                result
                            )
                        ) {
                            renderClips();

                            alert(
                                'Import dokončen.\n\n' +
                                'Uloženo klipů: ' +
                                result.length
                            );
                        }
                    };

                reader.onerror =
                    () => {
                        alert(
                            'Soubor se nepodařilo načíst.'
                        );
                    };

                reader.readAsText(
                    file
                );
            }
        );

        input.click();
    }

    // --------------------------------------------------
    // PANEL
    // --------------------------------------------------

    function createPanel() {
        if (
            document.getElementById(
                'youtube-ab-panel'
            )
        ) {
            return;
        }

        const panel =
            document.createElement(
                'div'
            );

        panel.id =
            'youtube-ab-panel';

        Object.assign(
            panel.style,
            {
                position: 'fixed',
                right: '12px',
                bottom: '80px',
                zIndex: '2147483647',
                background:
                    'rgba(20,20,20,.97)',
                color: '#fff',
                padding: '7px',
                borderRadius: '6px',
                fontFamily:
                    'Arial,sans-serif',
                fontSize: '10px',
                lineHeight: '1.2',
                boxShadow:
                    '0 3px 12px rgba(0,0,0,.6)',
                width: '360px',
                maxWidth:
                    'calc(100vw - 24px)',
                boxSizing:
                    'border-box'
            }
        );

        const top =
            document.createElement(
                'div'
            );

        Object.assign(
            top.style,
            {
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                marginBottom: '5px'
            }
        );

        const info =
            document.createElement(
                'span'
            );

        info.style.flex = '1';
        info.style.whiteSpace =
            'nowrap';

        const a =
            document.createElement(
                'span'
            );

        a.id = 'ab-A';

        const b =
            document.createElement(
                'span'
            );

        b.id = 'ab-B';

        info.append(a);

        info.append(
            document.createTextNode(
                '  '
            )
        );

        info.append(b);

        const btnA =
            createButton(
                'ab-set-A',
                'A'
            );

        const btnB =
            createButton(
                'ab-set-B',
                'B'
            );

        const loop =
            createButton(
                'ab-loop',
                'LOOP OFF'
            );

        const minus =
            createButton(
                'ab-minus',
                '−'
            );

        const speedDisplay =
            createButton(
                'ab-speed',
                '1.00×'
            );

        const plus =
            createButton(
                'ab-plus',
                '+'
            );

        const clear =
            createButton(
                'ab-clear',
                'CLR'
            );

        top.append(
            info,
            btnA,
            btnB,
            loop,
            minus,
            speedDisplay,
            plus,
            clear
        );

        const save =
            createButton(
                'ab-save',
                '💾 ULOŽIT KLIP'
            );

        Object.assign(
            save.style,
            {
                background:
                    '#065fd4',
                width: '100%',
                marginBottom: '5px',
                padding: '6px 7px'
            }
        );

        const management =
            document.createElement(
                'div'
            );

        Object.assign(
            management.style,
            {
                display: 'flex',
                gap: '3px',
                marginBottom: '5px'
            }
        );

        const exportButton =
            createButton(
                'ab-export',
                '⬆ EXPORT'
            );

        const importButton =
            createButton(
                'ab-import',
                '⬇ IMPORT'
            );

        exportButton.style.flex =
            '1';

        importButton.style.flex =
            '1';

        management.append(
            exportButton,
            importButton
        );

        const listTitle =
            document.createElement(
                'div'
            );

        listTitle.textContent =
            'MOJE KLIPY';

        Object.assign(
            listTitle.style,
            {
                fontWeight: 'bold',
                fontSize: '10px',
                marginBottom: '3px'
            }
        );

        const list =
            document.createElement(
                'div'
            );

        list.id =
            'ab-clips-list';

        panel.append(
            top,
            save,
            management,
            listTitle,
            list
        );

        document.body.appendChild(
            panel
        );

        btnA.addEventListener(
            'click',
            setA
        );

        btnB.addEventListener(
            'click',
            setB
        );

        loop.addEventListener(
            'click',
            toggleLoop
        );

        minus.addEventListener(
            'click',
            () =>
                changeSpeed(
                    -SPEED_STEP
                )
        );

        plus.addEventListener(
            'click',
            () =>
                changeSpeed(
                    SPEED_STEP
                )
        );

        clear.addEventListener(
            'click',
            clearAB
        );

        save.addEventListener(
            'click',
            saveCurrentClip
        );

        exportButton.addEventListener(
            'click',
            exportClips
        );

        importButton.addEventListener(
            'click',
            importClips
        );

        renderClips();
        update();
    }

    // --------------------------------------------------
    // KEYBOARD
    // --------------------------------------------------

    function handleKeyboard(e) {
        const target =
            e.target;

        if (
            target &&
            (
                target.tagName ===
                    'INPUT' ||
                target.tagName ===
                    'TEXTAREA' ||
                target.isContentEditable
            )
        ) {
            return;
        }

        const key =
            e.key.toLowerCase();

        if (key === 'a') {
            setA();
        }

        else if (key === 'b') {
            setB();
        }

        else if (key === 'l') {
            toggleLoop();
        }

        else if (key === 'r') {
            clearAB();
        }

        else if (
            e.key === '<' ||
            e.key === ','
        ) {
            changeSpeed(
                -SPEED_STEP
            );
        }

        else if (
            e.key === '>' ||
            e.key === '.'
        ) {
            changeSpeed(
                SPEED_STEP
            );
        }
    }

    document.addEventListener(
        'keydown',
        handleKeyboard
    );

    // --------------------------------------------------
    // HLAVNÍ SMYČKA
    // --------------------------------------------------

    setInterval(
        () => {
            getVideo();
            createPanel();

            if (
                video &&
                looping &&
                A !== null &&
                B !== null
            ) {
                if (
                    video.currentTime >= B ||
                    video.currentTime < A
                ) {
                    video.currentTime =
                        A;

                    const p =
                        video.play();

                    if (
                        p &&
                        typeof p.catch ===
                            'function'
                    ) {
                        p.catch(
                            () => {}
                        );
                    }
                }
            }

            update();

        },
        100
    );

    // --------------------------------------------------
    // START
    // --------------------------------------------------

    installNavigationHandlers();

    setTimeout(
        () => {
            createPanel();
            consumePendingClip();
        },
        1000
    );

})();
