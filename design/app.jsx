// Main app — state, routing, theme wiring

function appReducer(state, action) {
    switch (action.type) {
        case 'toggle': {
            const items = state.items.map(i => {
                if (i.id !== action.id) return i;
                const next = !i.checked;
                // if recurring and being checked, schedule reappear (simulate)
                return {...i, checked: next};
            });
            return {...state, items};
        }
        case 'edit_item':
            return {...state, sheet: {kind: 'edit', id: action.id}};
        case 'open_sheet':
            return {...state, sheet: {kind: action.sheet}};
        case 'close_sheet':
            return {...state, sheet: null};
        case 'add_item':
            return {...state, items: [action.item, ...state.items]};
        case 'update_item': {
            const items = state.items.map(i => i.id === action.id ? {...i, ...action.patch} : i);
            return {...state, items};
        }
        case 'delete_item':
            return {...state, items: state.items.filter(i => i.id !== action.id)};
        case 'add_list':
            return {...state, lists: [...state.lists, action.list], activeList: action.list.id};
        case 'set_active_list':
            return {...state, activeList: action.listId};
        case 'go':
            return {...state, screen: action.screen};
        case 'reset':
            return makeInitialState();
        default:
            return state;
    }
}

function makeInitialState() {
    const seed = window.__BP_SEED;
    return {
        items: seed.items,
        categories: seed.categories,
        lists: seed.lists,
        members: seed.members,
        activeList: 'main',
        screen: 'today', // today | lists | you | categories | catalog
        sheet: null,
    };
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "light",
    "accent": "teal",
    "density": "cozy",
    "showStore": true,
    "showRecurring": true
}/*EDITMODE-END*/;

function App() {
    const [state, dispatch] = React.useReducer(appReducer, undefined, makeInitialState);
    const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
    const rootRef = React.useRef(null);

    // Apply theme + accent + density CSS vars to the device root
    React.useEffect(() => {
        if (rootRef.current) {
            window.BPTheme.applyToRoot(rootRef.current, {
                theme: t.theme, accent: t.accent, density: t.density,
            });
        }
    }, [t.theme, t.accent, t.density]);

    const dark = t.theme === 'dark';

    // Pick screen
    let screen = null;
    if (state.screen === 'today') screen = <ScreenToday state={state} dispatch={dispatch} t={t}/>;
    else if (state.screen === 'lists') screen = <ScreenLists state={state} dispatch={dispatch}/>;
    else if (state.screen === 'you') screen = <ScreenHousehold state={state} dispatch={dispatch}/>;
    else if (state.screen === 'categories') screen = <ScreenCategories state={state} dispatch={dispatch}/>;
    else if (state.screen === 'catalog') screen = <ScreenCatalog state={state} dispatch={dispatch}/>;
    else screen = <ScreenToday state={state} dispatch={dispatch} t={t}/>;

    const tab = (['today', 'lists', 'you'].includes(state.screen)) ? state.screen :
        (state.screen === 'categories' || state.screen === 'catalog') ? 'lists' : 'today';

    return (
        <React.Fragment>
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '100vw', minHeight: '100vh', padding: '32px 16px',
                background: '#0d0d10',
                backgroundImage: 'radial-gradient(circle at 30% 20%, #1a1a22 0%, #0d0d10 60%)',
            }}>
                <IOSDevice dark={dark} width={402} height={874}>
                    <div ref={rootRef} style={{
                        position: 'absolute', inset: 0, overflow: 'hidden',
                        background: 'var(--bp-bg)', color: 'var(--bp-text)',
                        fontFamily: '-apple-system, "SF Pro Text", "SF Pro", system-ui, sans-serif',
                        WebkitFontSmoothing: 'antialiased',
                        display: 'flex', flexDirection: 'column',
                    }}>
                        {/* Status bar */}
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            zIndex: 50,
                            pointerEvents: 'none'
                        }}>
                            <IOSStatusBar dark={dark}/>
                        </div>

                        {/* Scrollable content */}
                        <div style={{flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative'}}>
                            {screen}
                        </div>

                        {/* Tab bar */}
                        <BPTabBar active={tab} onChange={(id) => dispatch({type: 'go', screen: id})}/>

                        {/* Home indicator overlay */}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 60,
                            height: 22, display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
                            paddingBottom: 6, pointerEvents: 'none',
                        }}>
                            <div style={{
                                width: 134, height: 5, borderRadius: 100,
                                background: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.32)',
                            }}/>
                        </div>

                        {/* Sheets */}
                        <SheetItemEditor state={state} dispatch={dispatch} t={t}/>
                        <SheetInvite state={state} dispatch={dispatch}/>
                        <SheetShare state={state} dispatch={dispatch}/>
                        <SheetNewList state={state} dispatch={dispatch}/>
                    </div>
                </IOSDevice>
            </div>

            {/* Tweaks panel */}
            <TweaksPanel title="Tweaks">
                <TweakSection label="Appearance"/>
                <TweakRadio
                    label="Theme" value={t.theme}
                    options={['light', 'dark', 'sepia']}
                    onChange={(v) => setTweak('theme', v)}
                />
                <TweakColor
                    label="Accent" value={accentSwatch(t.accent)}
                    options={['#2AA396', '#8E5BD9', '#FA8A2A', '#34A853']}
                    onChange={(hex) => setTweak('accent', swatchToAccent(hex))}
                />
                <TweakRadio
                    label="Density" value={t.density}
                    options={['compact', 'cozy', 'comfy']}
                    onChange={(v) => setTweak('density', v)}
                />
                <TweakSection label="Item display"/>
                <TweakToggle label="Show store" value={t.showStore}
                             onChange={(v) => setTweak('showStore', v)}/>
                <TweakToggle label="Show recurring" value={t.showRecurring}
                             onChange={(v) => setTweak('showRecurring', v)}/>
                <TweakSection label="Demo"/>
                <TweakButton label="Reset data" onClick={() => dispatch({type: 'reset'})}/>
            </TweaksPanel>
        </React.Fragment>
    );
}

// map between accent name and a color swatch (for TweakColor display)
function accentSwatch(name) {
    return {teal: '#2AA396', purple: '#8E5BD9', orange: '#FA8A2A', green: '#34A853'}[name] || '#2AA396';
}

function swatchToAccent(hex) {
    return {'#2AA396': 'teal', '#8E5BD9': 'purple', '#FA8A2A': 'orange', '#34A853': 'green'}[hex] || 'teal';
}

window.App = App;
