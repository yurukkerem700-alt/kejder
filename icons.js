/* Börü: Son Kral — oyuna özel ikon seti
 * Ekranda görünen standart emojileri, aynı koyu konturlu, kor/altın/kemik paletli çizimlerle değiştirir.
 * Yalnızca GÖRÜNÜMÜ değiştirir: metin içeriği (ve sunucuya giden veri) emoji olarak kalır, ses/okuma bozulmaz.
 * Canvas içine çizilen emojilere dokunmaz. Tanımsız emojiler olduğu gibi kalır. */
(function () {
    'use strict';
    const K = '#1b0b06';                                   // kontur
    const E1 = '#ff6a1a', E2 = '#ffb02e', G1 = '#ffd24a', G2 = '#b8730a', BN = '#eadfc4', ST = '#8fa3b8', SD = '#56677a';
    const BL = '#c4202b', IC = '#7fd8ff', VN = '#6ddb4a', VI = '#9b5cff', WD = '#7a3a14', WD2 = '#3a1a0a';
    const o = `stroke="${K}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
    const p = (d, f, x) => `<path d="${d}" fill="${f}" ${o} ${x || ''}/>`;
    const c = (cx, cy, r, f, x) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${o} ${x || ''}/>`;
    const l = (d, s, w) => `<path d="${d}" fill="none" stroke="${s}" stroke-width="${w || 1.4}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const dot = (cx, cy, r, f) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f || K}"/>`;

    const dragonHead = p('M2.5 16.5C3.5 10 8 6.5 14 7l5-3.5-1.2 5.2c1.4 1.6 2 3.6 1.2 6l-3.3 2.8-3-2-4.3 1.2-3.2 2.3z', E1) +
        p('M7.5 8.2 6.8 3.8 10.6 6.6z', G1) + p('M12 6.6l1.2-3.4 2 3.7z', G1) + l('M9 13.2c2.2-.2 4-.9 5.6-2.2', E2, 1.2) + dot(15.4, 10.6, 1.1) + dot(18.2, 12.6, .6);

    const I = {
        '🐉': dragonHead,
        '🐲': dragonHead,
        '🦎': p('M3 17c3 1 5-1 7-4l5-2 5 2-2 2-3-.5-3 4.5c-2 3-6 3.5-9 .5z', VN) + c(17.5, 11.8, .9, K) + l('M4.5 18.5 2.8 21', K, 1.2),
        '🥚': p('M12 3C8 3 5.5 9 5.5 13.5 5.5 17.6 8.3 21 12 21s6.5-3.4 6.5-7.5C18.5 9 16 3 12 3z', BN) + l('M8.2 12.5 10 11l1.6 2 1.8-2.2L16 13', WD, 1.1) + dot(9.2, 8.5, 1.1, '#fff8'),
        '🐣': p('M12 4c-4 0-6.5 4-6.5 8 0 4 2.7 8 6.5 8s6.5-4 6.5-8c0-4-2.5-8-6.5-8z', G1) + p('M5.5 14l2.5-1.8 1.6 2 2.4-2.2 2.4 2.2 1.6-2L18.5 14c0 3.7-2.7 6-6.5 6s-6.5-2.3-6.5-6z', BN) + dot(10, 9, 1) + dot(14.4, 9, 1) + p('M11 11.4h2.4l-1.2 1.6z', E1),
        '⚔️': l('M5 4l14 14M19 4 5 18', ST, 2.6) + l('M5 4l3 .4M19 4l-3 .4', K, 1) + p('M3.4 16.4l4.2 4.2', G2) + p('M20.6 16.4l-4.2 4.2', G2) + l('M4.6 19.8 3 21.4M19.4 19.8l1.6 1.6', WD, 2.2) + l('M5 4l14 14M19 4 5 18', K, .6),
        '🛡️': p('M12 2.8 20 6v6c0 4.6-3.3 7.6-8 9.2C7.3 19.6 4 16.6 4 12V6z', ST) + p('M12 2.8V21.2C7.3 19.6 4 16.6 4 12V6z', SD, 'opacity=".55"') + l('M12 7v7M9 10h6', G1, 1.8),
        '👑': p('M3 18 4.5 7l4.5 5 3-7 3 7 4.5-5L21 18z', G1) + p('M3 18h18v2.6H3z', G2) + c(4.5, 6.4, 1.3, BL) + c(12, 4.6, 1.3, BL) + c(19.5, 6.4, 1.3, BL),
        '🔥': p('M12 2.5c.5 3-2.2 4.4-3.6 6.8C6.7 12 7 15.5 9 18c-2.8-.8-4.4-3.4-4.2-6.2C5 8 8.3 6.5 9 3.8c1.8 1.4 2.4 2.8 2.2 4.4C13 6.6 12.3 4.4 12 2.5z', E1, 'transform="translate(2.6 2) scale(.82)"') +
            p('M12 21c-3.3 0-5.8-2.3-5.8-5.4 0-3.4 3-5 3.8-8.6 3 1.4 3.4 3.4 3 5 1.2-.6 1.8-1.6 1.9-3 2.4 2.2 3.4 4.2 3.4 6.4 0 3.2-3.1 5.6-6.3 5.6z', E1) + p('M12.2 20.6c-2 0-3.5-1.4-3.5-3.2 0-2 1.8-2.8 2.4-5 2 1.2 2.6 2.6 2.4 3.8.8-.4 1.2-1 1.4-1.8 1.3 1.5 1.6 3 1.2 4.2-.5 1.3-2 2-3.9 2z', G1),
        '🕳️': `<ellipse cx="12" cy="12" rx="10" ry="6.4" fill="${VI}" ${o}/><ellipse cx="12" cy="12" rx="6.4" ry="3.8" fill="#4b1f94"/><ellipse cx="12" cy="12" rx="3.2" ry="1.9" fill="#05020a"/>` + l('M4.2 9.5C8 7 16 7 19.8 9.5', '#d9c2ff', .8),
        '🤝': p('M2.5 9.5 8 7l3 1.8 3-1.8 7.5 2.5v6l-4 .5-3.5 3.5-2.5-2.3L6.5 17l-4-1z', G1) + l('M8 7l3.4 3.2M14.5 8l-3 2.5 2 2', G2, 1.2) + l('M10 15l2 2', G2, 1.2),
        '🏠': p('M12 3.2 4 10v1.6h1.2V20h13.6v-8.4H20V10z', BN) + p('M12 3.2 3 10.2c3 1.6 6 1.6 9 0 3 1.6 6 1.6 9 0z', E1) + p('M10 20v-5.2c0-1.2 4-1.2 4 0V20z', WD2) + l('M12 3.2V1.6', K, 1.2),
        '👥': c(9, 8, 3.2, E2) + p('M2.8 19.5c0-4 2.8-6 6.2-6s6.2 2 6.2 6z', E1) + c(16.6, 9, 2.6, G1) + p('M15.4 14c3.2-.4 6 1.3 6 5.5H17z', G2),
        '🎤': p('M9 3.5a3 3 0 0 1 6 0V11a3 3 0 0 1-6 0z', ST) + l('M5.5 10.5c0 4 2.7 6.5 6.5 6.5s6.5-2.5 6.5-6.5M12 17v3.5M8.5 20.5h7', K, 1.6) + l('M10.2 6.5h3.6M10.2 8.8h3.6', SD, 1),
        '🔊': p('M3 9.5h3.5L11 5.5v13l-4.5-4H3z', G1) + l('M14 9c1.5 1.7 1.5 4.3 0 6M16.8 6.5c3 3.2 3 7.8 0 11', E2, 1.6),
        '🔈': p('M3 9.5h3.5L11 5.5v13l-4.5-4H3z', G1) + l('M14 9.5c1.2 1.4 1.2 3.6 0 5', E2, 1.6),
        '🔇': p('M3 9.5h3.5L11 5.5v13l-4.5-4H3z', ST) + l('M14.5 9.5l5 5M19.5 9.5l-5 5', BL, 1.8),
        '⏱️': p('M7 3h10v2.6c0 2.6-2.6 3.8-2.6 6.4S17 14.4 17 17v4H7v-4c0-2.6 2.6-3.8 2.6-5S7 8.2 7 5.6z', IC, 'fill-opacity=".35"') + l('M7 3h10M7 21h10', G2, 2) + p('M9.4 19.5c1.4-1.8 4.6-1.8 5.2 0z', G1) + l('M12 11.6v2', G1, 1.4),
        '🏆': p('M7 3.5h10v5.2C17 12 14.8 14 12 14S7 12 7 8.7z', G1) + l('M7 5.5H3.8c0 3 1.6 4.4 3.4 4.4M17 5.5h3.2c0 3-1.6 4.4-3.4 4.4', G2, 1.6) + p('M10.6 14h2.8l.4 3.5h-3.6z', G2) + p('M7.6 17.5h8.8V20H7.6z', G2) + l('M9.2 5.5v3', '#fff9', 1.2),
        '🎁': p('M4 10h16v10.5H4z', BL) + p('M3 7h18v3.4H3z', E1) + p('M10.6 7h2.8v13.5h-2.8z', G1) + p('M12 7C9 7 7.2 5 8.4 3.8 10 2.5 11.8 5 12 7zM12 7c3 0 4.8-2 3.6-3.2C14 2.5 12.2 5 12 7z', G1),
        '📜': p('M6.5 4h11a2.5 2.5 0 0 1 0 5H8.5V18a2.5 2.5 0 0 1-5 0 2 2 0 0 1 2-2h2', BN) + p('M8.5 9v9a2.5 2.5 0 0 0 2.5 2.5H18a2.5 2.5 0 0 0 2.5-2.5V17h-7', BN) + l('M11 12h6M11 14.6h5', WD, 1),
        '📖': p('M12 6.5C9.5 4.8 6 4.6 3 5.5v13c3-.9 6.5-.7 9 1z', BN) + p('M12 6.5c2.5-1.7 6-1.9 9-1v13c-3-.9-6.5-.7-9 1z', '#f4ead0') + l('M5.5 8.5c1.7-.3 3.3-.1 4.5.6M5.5 11.5c1.7-.3 3.3-.1 4.5.6M14 9.1c1.2-.7 2.8-.9 4.5-.6M14 12.1c1.2-.7 2.8-.9 4.5-.6', WD, 1),
        '⚙️': p('M10.2 2.8h3.6l.5 2.4 1.7.7 2-1.4 2.5 2.5-1.4 2 .7 1.7 2.4.5v3.6l-2.4.5-.7 1.7 1.4 2-2.5 2.5-2-1.4-1.7.7-.5 2.4h-3.6l-.5-2.4-1.7-.7-2 1.4-2.5-2.5 1.4-2-.7-1.7-2.4-.5v-3.6l2.4-.5.7-1.7-1.4-2L6 4.5l2 1.4 1.7-.7z', ST) + c(12, 12, 3.3, '#243040'),
        '🗺️': p('M3 6.5 9 4.5l6 2 6-2v13l-6 2-6-2-6 2z', '#e7d3a1') + l('M9 4.5v13M15 6.5v13', WD, 1) + l('M5 10c1.2-1 2.4 1 3.4 0M17 9.5c1 1.4 2.4-.6 3 .6M11 14c1.5-1 2.5 1 3.4 0', WD, 1) + p('M16.2 12.2l1.1 1.6 1.4-2z', BL),
        '💀': p('M12 2.8c-4.6 0-7.5 3-7.5 7 0 2.6 1.2 4.3 2.8 5.3V19h9.4v-3.9c1.6-1 2.8-2.7 2.8-5.3 0-4-2.9-7-7.5-7z', BN) + c(9, 10.4, 2, K) + c(15, 10.4, 2, K) + p('M12 13l-1.1 2.2h2.2z', K) + l('M9.6 19v-2.2M12 19v-2.2M14.4 19v-2.2', K, 1),
        '☠️': p('M12 3c-4 0-6.4 2.6-6.4 6 0 2.3 1 3.7 2.4 4.5V16h8v-2.5c1.4-.8 2.4-2.2 2.4-4.5 0-3.4-2.4-6-6.4-6z', BN) + c(9.4, 9.6, 1.7, K) + c(14.6, 9.6, 1.7, K) + l('M4 17.5l16 4M20 17.5l-16 4', BN, 2.2) + l('M4 17.5l16 4M20 17.5l-16 4', K, .5),
        '⚡': p('M13.5 2 5 13.5h5.6L9.5 22 19 9.8h-6z', G1) + l('M12.2 5.5 8.3 11', '#fff9', 1),
        '💎': p('M7 4h10l4 5-9 11L3 9z', IC) + p('M3 9h18M7 4l2.2 5L12 20M17 4l-2.2 5L12 20M9.2 9h5.6', IC, 'fill-opacity=".0"') + l('M9.2 9 12 4.2 14.8 9', '#fffb', 1) + p('M3 9h18L12 20z', '#3aa5d9', 'fill-opacity=".55"'),
        '🌌': `<circle cx="12" cy="12" r="9.4" fill="#120b2c" ${o}/>` + l('M5 15c3-5 9-7 14-3M7 18c4-3 8-4 11-2', VI, 1.8) + l('M8 8c2-2 5-2.5 7-1', IC, 1.2) + dot(7, 8, .7, '#fff') + dot(16.5, 15.5, .7, '#fff') + dot(13, 5.5, .6, '#fff'),
        '🧪': p('M9.5 3h5v5.4l4.4 8.5c.8 1.7-.3 3.6-2.2 3.6H7.3c-1.9 0-3-1.9-2.2-3.6L9.5 8.4z', '#dfe9f2', 'fill-opacity=".5"') + p('M7 15h10l1.6 2.6c.5 1-.1 2.4-1.5 2.4H6.9c-1.4 0-2-1.4-1.5-2.4z', VN) + l('M8.5 3h7', K, 1.6) + dot(10.5, 17.6, .8, '#fff8') + dot(13.5, 16.4, .6, '#fff8'),
        '💰': p('M9 3.5c1 1.2 1.8 1.2 3 0 1.2 1.2 2 1.2 3 0l-1.6 3.6H10.6z', '#9a6a2a') + p('M10.6 7.1C5 10 3.6 14 4.6 17.6c.8 2.6 3.6 3.9 7.4 3.9s6.6-1.3 7.4-3.9c1-3.6-.4-7.6-6-10.5z', '#b98035') + l('M12 11v7M14.2 12.6c-1-1-4.2-.8-4.2.8 0 2.2 4.4 1 4.4 3.2 0 1.7-3.4 1.8-4.6.4', G1, 1.4),
        '🪙': c(12, 12, 8.6, G1) + c(12, 12, 5.8, 'none', `stroke="${G2}"`) + l('M12 8v8M14 9.6c-.8-.8-4-.8-4 .9 0 2 4 1 4 3 0 1.7-3.2 1.7-4 .7', G2, 1.3),
        '❄️': l('M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2 3.8 16.8', IC, 1.9) + l('M9.5 4.6 12 7l2.5-2.4M9.5 19.4 12 17l2.5 2.4M4.4 10.4l3.3-.6-.6-3.3M19.6 13.6l-3.3.6.6 3.3M4.4 13.6l3.3.6-.6 3.3M19.6 10.4l-3.3-.6.6-3.3', IC, 1.4),
        '🌑': `<circle cx="12" cy="12" r="9" fill="#2b2f45" ${o}/>` + c(9, 9.5, 1.6, '#1a1c2b', 'stroke="none"') + c(15, 14.5, 2.2, '#1a1c2b', 'stroke="none"') + l('M6.5 7.5C8 5.5 10 4.7 12 4.7', '#8a92c0', 1),
        '🌘': `<circle cx="12" cy="12" r="9" fill="#1b1e30" ${o}/><path d="M15.6 4.3A8.6 8.6 0 1 0 15.6 19.7 7 7 0 0 1 15.6 4.3z" fill="${G1}" ${o}/>`,
        '🏰': p('M3.5 20.5V8h3v2h2.5V8h2V6h-1V3.5h1.5V5h1V3.5H14V5h1V3.5h1.5V6h-1v2h2v2H17V8h3.5v12.5z', '#9a8f7e') + p('M10 20.5v-5c0-2.2 4-2.2 4 0v5z', WD2) + p('M5 12.6h2v2.2H5zM17 12.6h2v2.2h-2z', K) + l('M3.5 12h17', '#6e6556', .9),
        '🔒': p('M5.5 10.5h13V21h-13z', G1) + l('M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7', ST, 2.4) + l('M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7', K, .6) + c(12, 15.4, 1.5, K) + l('M12 15.4v2.6', K, 1.4),
        '🌐': `<circle cx="12" cy="12" r="9.2" fill="#2d7bb8" ${o}/>` + p('M6.5 7.5c2-1.6 3.6-.4 4.2 1.2.5 1.5-1.2 2.2-1 3.6.2 1.4-1.4 1.4-2.2.4-1.2-1.4-2.6-3.4-1-5.2zM14 13.5c1.6-.8 3.5.2 3.6 1.8.1 1.8-1.7 3.4-3 3.2-1.6-.2-2.2-4-.6-5z', VN, 'stroke-width=".8"') + l('M12 2.8c3 3 3 15.4 0 18.4M12 2.8c-3 3-3 15.4 0 18.4M3 12h18', '#ffffff55', .8),
        '🌍': `<circle cx="12" cy="12" r="9.2" fill="#2d7bb8" ${o}/>` + p('M6.5 7.5c2-1.6 3.6-.4 4.2 1.2.5 1.5-1.2 2.2-1 3.6.2 1.4-1.4 1.4-2.2.4-1.2-1.4-2.6-3.4-1-5.2zM14 13.5c1.6-.8 3.5.2 3.6 1.8.1 1.8-1.7 3.4-3 3.2-1.6-.2-2.2-4-.6-5z', VN, 'stroke-width=".8"'),
        '➕': l('M12 4.5v15M4.5 12h15', '#ffe9a8', 3.6) + l('M12 4.5v15M4.5 12h15', E1, 2),
        '🚪': p('M6 3.5h9.5v17H6z', WD) + p('M15.5 3.5 19 5v15l-3.5.5z', WD2) + c(13.2, 12.4, .9, G1) + l('M8 7h5M8 10h5', '#a35a22', 1),
        '🔑': c(8, 8.5, 4.3, G1) + c(7, 7.6, 1.3, K) + l('M11 11.5 20.5 21M16.6 17.2l2.2-2.2M18.4 19l2-2', G1, 2.4) + l('M11 11.5 20.5 21', K, .5),
        '📤': p('M3.5 13.5h4v6h9v-6h4V21h-17z', ST) + l('M12 14V3.8M7.8 8 12 3.8 16.2 8', G1, 2.4),
        '👁️': p('M1.8 12C4.5 7 8 5 12 5s7.5 2 10.2 7c-2.7 5-6.2 7-10.2 7S4.5 17 1.8 12z', '#f4ead0') + c(12, 12, 4.2, E2) + c(12, 12, 2, K) + dot(13, 11, .7, '#fff'),
        '🙈': c(12, 12, 9.2, WD) + p('M6 12.5c0-3 2.4-5 6-5s6 2 6 5c0 3.4-2.4 5.5-6 5.5s-6-2.1-6-5.5z', '#d9a066') + p('M5.5 9.5 9 13.5 5.5 15zM18.5 9.5 15 13.5l3.5 1.5z', WD2),
        '🪪': p('M2.8 5.5h18.4v13H2.8z', BN) + c(8, 11, 2.2, E2) + p('M4.4 17c0-2.6 1.6-3.8 3.6-3.8s3.6 1.2 3.6 3.8z', E1) + l('M13.5 9.5h5.5M13.5 12.5h5.5M13.5 15.5h3.5', WD, 1.3),
        '📲': p('M7 2.5h10a1.5 1.5 0 0 1 1.5 1.5v16a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 20V4A1.5 1.5 0 0 1 7 2.5z', '#2a3342') + p('M7.2 5h9.6v12H7.2z', E1, 'fill-opacity=".85"') + l('M12 7v6M9.5 10.8 12 13.3l2.5-2.5', '#fff', 1.6),
        '🎮': p('M5 8h14c2.6 0 4 2.6 3.4 6-.5 3.2-2.2 4.8-4 3.4L15.4 15H8.6l-2 2.4c-1.8 1.4-3.5-.2-4-3.4C2 10.6 2.4 8 5 8z', SD) + l('M7 10.5v3.2M5.4 12.1h3.2', BN, 1.6) + c(16.4, 11.2, 1, E1, 'stroke="none"') + c(18.4, 13, 1, G1, 'stroke="none"'),
        '🌳': p('M12 2.5c3.4 0 5.8 2.5 5.2 5.4 2.2.9 3 3.6 1.6 5.4-1 1.3-2.7 1.6-4 1.2L13 15.5V21h-2v-5.5L9.2 14c-1.3.4-3-.1-4-1.4-1.4-1.8-.6-4.5 1.6-5.4-.6-2.9 1.8-5.4 5.2-4.7z', '#3f8f3a') + l('M12 15.5V21', WD, 2.2),
        '🔮': `<circle cx="12" cy="11" r="7.6" fill="${VI}" fill-opacity=".8" ${o}/>` + p('M6.5 20.5h11l-1.5-3h-8z', G2) + l('M8 8.5c1-1.6 2.6-2.4 4-2.4', '#fff9', 1.4) + dot(14.5, 13, 1.2, '#ffffff66'),
        '🗿': p('M7 3.5h10l1.2 5.5-1 2 .8 2.5-1.5 7.5H7.5L6 13.5l.8-2.5-1-2z', '#8d8a82') + p('M7.5 9h3v1.6h-3zM13.5 9h3v1.6h-3zM11 11l-.8 3.4H12z', K) + l('M9 17h6', K, 1.2),
        '💨': l('M3 8h10.5a2.6 2.6 0 1 0-2.5-3M3 12.5h15a2.8 2.8 0 1 1-2.6 3.8M3 17h7', IC, 2.2),
        '😈': c(12, 13.5, 7.2, VI) + p('M5.6 9 4 3.8l4.4 2.6zM18.4 9 20 3.8l-4.4 2.6z', G1) + p('M8.2 12 11 13.2 8.4 14.6zM15.8 12 13 13.2l2.6 1.4z', K) + l('M8.5 17.6c2 1.4 5 1.4 7 0', K, 1.3),
        '🧛': p('M12 3 8 8l-4-1 1 8c1 3 4 5.5 7 5.5s6-2.5 7-5.5l1-8-4 1z', BN) + p('M9.3 15.5 10.4 19l1.2-3.5zM12.4 15.5 13.6 19l1.1-3.5z', '#fff', 'stroke-width=".8"') + p('M8.4 12.2 11 12.8 8.6 13.8zM15.6 12.2 13 12.8l2.4 1z', BL),
        '🧲': p('M4 12a8 8 0 0 1 16 0v3.5h-4.8V12a3.2 3.2 0 0 0-6.4 0v3.5H4z', BL) + p('M4 15.5h4.8V19H4zM15.2 15.5H20V19h-4.8z', BN),
        '⚛️': `<ellipse cx="12" cy="12" rx="9.4" ry="3.8" fill="none" stroke="${IC}" stroke-width="1.5"/><ellipse cx="12" cy="12" rx="9.4" ry="3.8" fill="none" stroke="${IC}" stroke-width="1.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9.4" ry="3.8" fill="none" stroke="${IC}" stroke-width="1.5" transform="rotate(120 12 12)"/>` + c(12, 12, 2.2, G1),
        '🦅': p('M2 8c4 0 6 1.8 8 4.6l2 1.8 2-1.8C16 9.8 18 8 22 8c-1.6 3-2.2 5.6-3.4 8.2-1.4 3-3.8 4.4-6.6 4.4S6.8 19.2 5.4 16.2C4.2 13.6 3.6 11 2 8z', E1) + p('M12 14.4l-1.6 4.2 1.6 1.8 1.6-1.8z', G1) + dot(10.2, 12.4, .8) + dot(13.8, 12.4, .8),
        '💖': p('M12 20.5C4 14.8 3 11 3 8.6A4.6 4.6 0 0 1 7.6 4c1.8 0 3.4.9 4.4 2.5C13 4.9 14.600 4 16.4 4A4.6 4.6 0 0 1 21 8.600c0 2.400-1 6.200-9 11.900z', BL) + l('M6.5 8.2c.2-1.2 1.2-2 2.3-2', '#fff9', 1.2),
        '💗': p('M12 20.5C4 14.8 3 11 3 8.6A4.6 4.6 0 0 1 7.6 4c1.8 0 3.4.9 4.4 2.5C13 4.9 14.600 4 16.4 4A4.6 4.6 0 0 1 21 8.600c0 2.400-1 6.200-9 11.900z', '#e0455f'),
        '💗️': '',
        '📡': l('M5 19l7-9 7 9M3 12a10 10 0 0 1 4-8M21 12a10 10 0 0 0-4-8', G1, 1.8) + c(12, 9.6, 1.9, E1) + l('M7.8 19h8.4', K, 1.6),
        '⚜️': p('M12 2.5c2.8 2.600 2.800 6 0 8.500C9.200 8.500 9.200 5.100 12 2.500zM5.500 8c3 .2 4.500 2.600 4.500 5.500H7c-2.200 0-3.200-2.800-1.500-5.500zM18.500 8c-3 .2-4.500 2.600-4.500 5.500h3c2.200 0 3.200-2.800 1.500-5.500z', G1) + p('M7 14.500h10v2.200H7zM10.500 16.700h3v4.300h-3z', G2),
        '🟢': c(12, 12, 6, '#3fe08a'),
        '⚫': c(12, 12, 6, '#4a4f60'),
        '🏴‍☠️': p('M5 3v18', WD, 'fill="none"') + p('M5 4h14l-2.200 4 2.200 4H5z', '#1c1a22') + c(11, 8, 1.700, BN) + l('M8.500 11l5-.2', BN, 1),
        '🏴': p('M5 4h14l-2.200 4 2.200 4H5z', '#1c1a22') + l('M5 3v18', WD, 2),
        '🏁': l('M5 3v18', WD, 2) + p('M5 4h14v8H5z', '#fff') + p('M5 4h3.500v4H5zM12 4h3.500v4H12zM8.500 8H12v4H8.500zM15.500 8H19v4h-3.500z', K),
        '📍': p('M12 2.500a6.500 6.500 0 0 0-6.500 6.500C5.500 14 12 21.500 12 21.500S18.500 14 18.500 9A6.500 6.500 0 0 0 12 2.500z', BL) + c(12, 9, 2.300, '#fff'),
        '🧿': c(12, 12, 9, '#1f5fa8') + c(12, 12, 6.200, '#fff') + c(12, 12, 3.800, '#3aa5d9') + c(12, 12, 1.700, K),
        '✨': p('M12 2.500 14.200 9.800 21.500 12 14.200 14.200 12 21.500 9.800 14.200 2.500 12 9.800 9.800z', G1),
        '⭐': p('M12 2.600 14.700 9 21.500 9.500 16.300 14l1.600 6.800L12 17.200 6.100 20.800 7.700 14 2.500 9.500 9.300 9z', G1),
        '🔔': p('M12 3c-3.500 0-5.500 2.600-5.500 6v3.500L4.500 16h15l-2-3.500V9c0-3.400-2-6-5.500-6z', G1) + p('M10 17.500a2 2 0 0 0 4 0z', G2),
        '📌': p('M9 3h6l-.8 6 3.300 3.500H6.500L9.800 9z', BL) + l('M12 12.500V21', ST, 1.800),
        '⏸️': p('M6 4h4.500v16H6zM13.500 4H18v16h-4.500z', ST),
        '▶️': p('M7 4.500 19.500 12 7 19.500z', '#3fe08a'),
        '🔄': l('M20 11a8 8 0 0 0-14.500-3.500M4 13a8 8 0 0 0 14.500 3.500', G1, 2.200) + p('M3.500 3.500v5h5z', G1) + p('M20.500 20.500v-5h-5z', G1),
        '📱': p('M7 2.500h10a1.500 1.500 0 0 1 1.500 1.500v16a1.500 1.500 0 0 1-1.500 1.500H7A1.500 1.500 0 0 1 5.500 20V4A1.500 1.500 0 0 1 7 2.500z', '#2a3342') + p('M7.200 5h9.600v12H7.200z', IC, 'fill-opacity=".6"'),
        '🌳️': '',
        '🛒': '<i class="ic-market" style="width:100%;height:100%;vertical-align:baseline"></i>'
    };

    // ---- Yeniden çizilenler (küçük boyutta daha okunur)
    const head = p('M6.600 9.200 2.800 3.200c3.800.4 6 2.600 7 5.600z', G1) + p('M17.400 9.200 21.200 3.200c-3.800.4-6 2.600-7 5.600z', G1) +
        p('M12 21.200c-3.600 0-6.200-2.800-6.600-6.600C4.900 10.400 7.600 7.400 12 7.400s7.100 3 6.600 7.200c-.4 3.800-3 6.600-6.600 6.600z', E1) +
        l('M12 8v3.200M9.200 9.200l.6 1.600M14.800 9.200l-.6 1.600', E2, 1) +
        p('M7.600 11.600 11 12.700 10.100 14.400z', G1) + p('M16.400 11.600 13 12.700l.9 1.700z', G1) + dot(9.900, 13.100, .6) + dot(14.100, 13.100, .6) +
        p('M8.800 16.600c0-1.600 1.400-2.400 3.200-2.400s3.200.8 3.200 2.400-1.400 2.600-3.200 2.600-3.200-1-3.200-2.600z', E2) + dot(11, 16.300, .5) + dot(13, 16.300, .5) +
        p('M9.800 19.400l.5 2 .9-1.800zM14.200 19.400l-.5 2-.9-1.800z', BN, 'stroke-width=".8"');
    Object.assign(I, {
        '🐉': head, '🐲': head,
        '🦎': p('M2.800 15.500c0-3 2.800-4.600 6-4.600 3.600 0 5.600 1 7.600 1l3.200-2.200.6 3.400-2.600 1.800c-1 2.600-3 3.800-6 3.800H7.600C4.800 18.700 2.800 18.200 2.800 15.500z', VN) + l('M5 18.500 3.600 21M10 18.700 9 21.200M15 17.800l1.400 3', K, 1.600) + dot(18.600, 11.500, .8) + l('M6 13.200c1 .8 2.400 1 3.600.8M10.800 13.400c1 .6 2.200.6 3.200.1', '#2f8f2a', 1),
        '🛡️': p('M12 2.800 20 6v6c0 4.600-3.300 7.600-8 9.200C7.300 19.600 4 16.600 4 12V6z', ST) + p('M12 2.800V21.200C7.300 19.600 4 16.600 4 12V6z', SD, 'opacity=".55"') + p('M12 7.200 15.200 12 12 16.800 8.800 12z', E1) + p('M12 9.600 13.400 12 12 14.400 10.600 12z', G1),
        '🔥': p('M12 2.200c.9 3.400 5.800 6 5.800 11.600A5.800 5.800 0 0 1 12 19.800a5.800 5.800 0 0 1-5.800-6c0-2.600 1.300-4.200 2.800-5.600.2 1.600.9 2.600 1.900 3C10.500 8.600 10.500 4.800 12 2.200z', E1) +
            p('M12 20a3.200 3.200 0 0 1-3.200-3.200c0-2.200 1.900-3 2.400-5.400 2 1.300 4 2.800 4 5.400A3.200 3.200 0 0 1 12 20z', G1),
        '🤝': `<circle cx="8.800" cy="12" r="5.200" fill="none" stroke="${K}" stroke-width="4.200"/><circle cx="8.800" cy="12" r="5.200" fill="none" stroke="${G1}" stroke-width="2.400"/><circle cx="15.200" cy="12" r="5.200" fill="none" stroke="${K}" stroke-width="4.200"/><circle cx="15.200" cy="12" r="5.200" fill="none" stroke="${E2}" stroke-width="2.400"/><path d="M12 7.300a5.200 5.200 0 0 1 0 9.400" fill="none" stroke="${G1}" stroke-width="2.400"/>`
    });

    // ---- Kurulum
    const keys = Object.keys(I).filter(k => I[k]).sort((a, b) => b.length - a.length);
    const norm = (s) => s.replace(/️/g, '');
    const map = {}; keys.forEach(k => { map[norm(k)] = I[k]; });
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const RE = new RegExp(keys.map(k => esc(norm(k)) + '\\uFE0F?').join('|'), 'g');
    const TEST = new RegExp(keys.map(k => esc(norm(k))).join('|'));
    const SKIP = /^(SCRIPT|STYLE|CANVAS|TEXTAREA|INPUT|SELECT|OPTION|TITLE|SVG|NOSCRIPT)$/;
    const css = document.createElement('style');
    css.textContent = `.gi{display:inline-block;position:relative;width:1.2em;height:1.2em;vertical-align:-.26em;line-height:1;flex:0 0 auto}
        .gi>svg{display:block;width:100%;height:100%;overflow:visible;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))}
        .gi>.gt{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;opacity:0}`;
    (document.head || document.documentElement).appendChild(css);

    function inSkip(n) { for (let e = n.parentNode; e && e !== document.body; e = e.parentNode) { if (e.nodeType === 1 && (SKIP.test(e.nodeName) || (e.classList && (e.classList.contains('gi') || e.hasAttribute('data-noicon'))) || e.isContentEditable)) return true; } return false; }
    function swap(tn) {
        const s = tn.nodeValue; if (!s || !TEST.test(s) || inSkip(tn)) return;
        const frag = document.createDocumentFragment(); let last = 0, m; RE.lastIndex = 0;
        while ((m = RE.exec(s))) {
            if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
            const w = document.createElement('span'); w.className = 'gi';
            w.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + map[norm(m[0])] + '</svg><span class="gt">' + m[0] + '</span>';
            frag.appendChild(w); last = m.index + m[0].length;
        }
        if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
    }
    function scan(root) {
        if (!root) return;
        if (root.nodeType === 3) { swap(root); return; }
        if (root.nodeType !== 1 || SKIP.test(root.nodeName) || (root.classList && root.classList.contains('gi'))) return;
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => TEST.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT });
        const list = []; while (w.nextNode()) list.push(w.currentNode); list.forEach(swap);
    }
    // Değişiklikleri toplayıp kare başına bir kez işle (oyun HUD'unu yormasın)
    let q = new Set(), raf = 0;
    const flush = () => { raf = 0; const items = [...q]; q = new Set(); for (const n of items) { if (n.isConnected) scan(n); } };
    const mo = new MutationObserver((ms) => {
        for (const m of ms) {
            if (m.type === 'characterData') { if (m.target.nodeValue && TEST.test(m.target.nodeValue)) q.add(m.target); }
            else m.addedNodes.forEach(n => { if (n.nodeType === 1 || (n.nodeType === 3 && TEST.test(n.nodeValue))) q.add(n); });
        }
        if (q.size && !raf) raf = requestAnimationFrame(flush);
    });
    function start() { scan(document.body); mo.observe(document.body, { childList: true, subtree: true, characterData: true }); }
    window.BORU_ICONS = { has: (e) => !!map[norm(e)], html: (e) => map[norm(e)] ? '<span class="gi"><svg viewBox="0 0 24 24" aria-hidden="true">' + map[norm(e)] + '</svg><span class="gt">' + e + '</span></span>' : e, scan };
    if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
