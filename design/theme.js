// Theme system — CSS variables driven by Tweaks (theme, accent, density).
// Exposes window.BPTheme = { palette, applyToRoot }
(function () {
    const PALETTES = {
        light: {
            bg: '#F2F2F7',
            bg2: '#E5E5EA',
            card: '#FFFFFF',
            card2: '#F9F9FB',
            text: '#000000',
            sec: 'rgba(60,60,67,0.6)',
            ter: 'rgba(60,60,67,0.3)',
            sep: 'rgba(60,60,67,0.18)',
            sepStrong: 'rgba(60,60,67,0.28)',
            shadow: '0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.06)',
            navBg: 'rgba(242,242,247,0.82)',
            sheetBg: '#F2F2F7',
            stripe: 'rgba(0,0,0,0.03)',
            success: '#34C759',
            destructive: '#FF3B30',
            warning: '#FF9F0A',
            isDark: false,
        },
        dark: {
            bg: '#000000',
            bg2: '#0E0E10',
            card: '#1C1C1E',
            card2: '#2C2C2E',
            text: '#FFFFFF',
            sec: 'rgba(235,235,245,0.6)',
            ter: 'rgba(235,235,245,0.3)',
            sep: 'rgba(84,84,88,0.5)',
            sepStrong: 'rgba(120,120,128,0.55)',
            shadow: '0 1px 3px rgba(0,0,0,0.5), 0 8px 30px rgba(0,0,0,0.4)',
            navBg: 'rgba(0,0,0,0.78)',
            sheetBg: '#1C1C1E',
            stripe: 'rgba(255,255,255,0.03)',
            success: '#30D158',
            destructive: '#FF453A',
            warning: '#FFD60A',
            isDark: true,
        },
        sepia: {
            bg: '#EDE4CC',
            bg2: '#E2D7B8',
            card: '#F7EFD7',
            card2: '#F2E9CB',
            text: '#2A2419',
            sec: 'rgba(42,36,25,0.62)',
            ter: 'rgba(42,36,25,0.32)',
            sep: 'rgba(42,36,25,0.18)',
            sepStrong: 'rgba(42,36,25,0.28)',
            shadow: '0 1px 3px rgba(80,55,15,0.06), 0 6px 24px rgba(80,55,15,0.08)',
            navBg: 'rgba(237,228,204,0.85)',
            sheetBg: '#EDE4CC',
            stripe: 'rgba(42,36,25,0.04)',
            success: '#3E8E5C',
            destructive: '#B0392E',
            warning: '#B8801E',
            isDark: false,
        },
    };

    const ACCENTS = {
        teal: {base: '#2AA396', soft: 'rgba(42,163,150,0.14)', ring: 'rgba(42,163,150,0.30)'},
        purple: {base: '#8E5BD9', soft: 'rgba(142,91,217,0.14)', ring: 'rgba(142,91,217,0.30)'},
        orange: {base: '#FA8A2A', soft: 'rgba(250,138,42,0.14)', ring: 'rgba(250,138,42,0.30)'},
        green: {base: '#34A853', soft: 'rgba(52,168,83,0.14)', ring: 'rgba(52,168,83,0.30)'},
    };

    // For dark mode, accent gets a touch brighter for legibility
    const ACCENTS_DARK = {
        teal: {base: '#4DC9BB', soft: 'rgba(77,201,187,0.18)', ring: 'rgba(77,201,187,0.35)'},
        purple: {base: '#B388F5', soft: 'rgba(179,136,245,0.18)', ring: 'rgba(179,136,245,0.35)'},
        orange: {base: '#FFA552', soft: 'rgba(255,165,82,0.18)', ring: 'rgba(255,165,82,0.35)'},
        green: {base: '#5BD37A', soft: 'rgba(91,211,122,0.18)', ring: 'rgba(91,211,122,0.35)'},
    };

    const DENSITIES = {
        compact: {row: 44, gap: 0, headerGap: 14, fs: 16, sub: 12},
        cozy: {row: 52, gap: 0, headerGap: 18, fs: 17, sub: 13},
        comfy: {row: 62, gap: 0, headerGap: 22, fs: 17, sub: 13},
    };

    function applyToRoot(el, opts) {
        const {theme = 'light', accent = 'teal', density = 'cozy'} = opts || {};
        const p = PALETTES[theme] || PALETTES.light;
        const a = (p.isDark ? ACCENTS_DARK : ACCENTS)[accent] || ACCENTS.teal;
        const d = DENSITIES[density] || DENSITIES.cozy;
        const s = el.style;
        s.setProperty('--bp-bg', p.bg);
        s.setProperty('--bp-bg2', p.bg2);
        s.setProperty('--bp-card', p.card);
        s.setProperty('--bp-card2', p.card2);
        s.setProperty('--bp-text', p.text);
        s.setProperty('--bp-sec', p.sec);
        s.setProperty('--bp-ter', p.ter);
        s.setProperty('--bp-sep', p.sep);
        s.setProperty('--bp-sep-strong', p.sepStrong);
        s.setProperty('--bp-shadow', p.shadow);
        s.setProperty('--bp-nav-bg', p.navBg);
        s.setProperty('--bp-sheet-bg', p.sheetBg);
        s.setProperty('--bp-stripe', p.stripe);
        s.setProperty('--bp-success', p.success);
        s.setProperty('--bp-destructive', p.destructive);
        s.setProperty('--bp-warning', p.warning);
        s.setProperty('--bp-accent', a.base);
        s.setProperty('--bp-accent-soft', a.soft);
        s.setProperty('--bp-accent-ring', a.ring);
        s.setProperty('--bp-row-h', d.row + 'px');
        s.setProperty('--bp-header-gap', d.headerGap + 'px');
        s.setProperty('--bp-fs', d.fs + 'px');
        s.setProperty('--bp-fs-sub', d.sub + 'px');
        s.dataset && (el.dataset.theme = theme);
        el.dataset.theme = theme;
        el.dataset.density = density;
    }

    window.BPTheme = {PALETTES, ACCENTS, ACCENTS_DARK, DENSITIES, applyToRoot};
})();
