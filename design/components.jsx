// Shared UI components for Bag Please prototype.
// Loaded after React/Babel. Exports to window.

// ────────────────────────────────────────────────────────────────────
// Icons (stroke icons sized 1em via currentColor)
// ────────────────────────────────────────────────────────────────────
const BPIcons = {
    check: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.4"
                strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"/>
    </svg>,
    plus: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12h14"/>
    </svg>,
    search: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="7"/>
        <path d="m20 20-3.5-3.5"/>
    </svg>,
    clear: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <path d="m9 9 6 6m0-6-6 6"/>
    </svg>,
    chev: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.3"
               strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 6 15 12 9 18"/>
    </svg>,
    chevDn: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.3"
                 strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"/>
    </svg>,
    back: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.3"
               strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 6 9 12 15 18"/>
    </svg>,
    ellipsis: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
        <circle cx="5" cy="12" r="2"/>
        <circle cx="12" cy="12" r="2"/>
        <circle cx="19" cy="12" r="2"/>
    </svg>,
    filter: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2"
                 strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M6 12h12M10 18h4"/>
    </svg>,
    cart: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.9"
               strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 4h2l2.4 12.3a2 2 0 0 0 2 1.7h7.7a2 2 0 0 0 2-1.6L21 8H6"/>
        <circle cx="9" cy="20.5" r="1.3"/>
        <circle cx="18" cy="20.5" r="1.3"/>
    </svg>,
    list: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2"
               strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 6h13M8 12h13M8 18h13"/>
        <circle cx="4" cy="6" r="1.2"/>
        <circle cx="4" cy="12" r="1.2"/>
        <circle cx="4" cy="18" r="1.2"/>
    </svg>,
    person: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.9"
                 strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>
    </svg>,
    store: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.9"
                strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9 5 4h14l2 5"/>
        <path d="M4 9v11h16V9"/>
        <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>
        <path d="M10 20v-6h4v6"/>
    </svg>,
    repeat: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.9"
                 strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9"/>
        <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
        <polyline points="7 23 3 19 7 15"/>
        <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    </svg>,
    trash: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.9"
                strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6 17.6 19a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
    </svg>,
    share: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.9"
                strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v13"/>
        <polyline points="7 8 12 3 17 8"/>
        <path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>
    </svg>,
    bell: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.9"
               strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/>
        <path d="M10 21a2 2 0 0 0 4 0"/>
    </svg>,
    tag: <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.9"
              strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 12 12 20 3 11V3h8z"/>
        <circle cx="7.5" cy="7.5" r="1.3"/>
    </svg>,
};

// ────────────────────────────────────────────────────────────────────
// Avatar
// ────────────────────────────────────────────────────────────────────
function BPAvatar({member, size = 24, ring = false}) {
    if (!member) return null;
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: member.color, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: Math.round(size * 0.42), fontWeight: 600, letterSpacing: -0.2,
            boxShadow: ring ? '0 0 0 2px var(--bp-card)' : 'none',
            flexShrink: 0,
        }}>{member.initial}</div>
    );
}

// ────────────────────────────────────────────────────────────────────
// Checkbox (big hit target, animated)
// ────────────────────────────────────────────────────────────────────
function BPCheck({checked, size = 26, onClick}) {
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onClick && onClick();
            }}
            aria-pressed={checked}
            style={{
                appearance: 'none', border: 0, background: 'transparent',
                padding: 0, margin: 0, cursor: 'pointer',
                width: size + 16, height: size + 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}
        >
            <div style={{
                width: size, height: size, borderRadius: '50%',
                border: checked ? '0' : '1.5px solid var(--bp-ter)',
                background: checked ? 'var(--bp-accent)' : 'transparent',
                color: '#fff', fontSize: Math.round(size * 0.7),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 180ms ease, border-color 180ms ease, transform 120ms ease',
                transform: checked ? 'scale(1)' : 'scale(1)',
            }}>
        <span style={{
            opacity: checked ? 1 : 0,
            transform: checked ? 'scale(1)' : 'scale(0.4)',
            transition: 'opacity 160ms ease, transform 160ms ease',
            display: 'flex',
        }}>{BPIcons.check}</span>
            </div>
        </button>
    );
}

// ────────────────────────────────────────────────────────────────────
// Swipeable item row — swipe right to check, left to edit
// ────────────────────────────────────────────────────────────────────
function BPItemRow({item, member, onToggle, onEdit, onDelete, showStore = true, showRecurring = true}) {
    const [dx, setDx] = React.useState(0);
    const [animating, setAnimating] = React.useState(false);
    const startX = React.useRef(0);
    const startY = React.useRef(0);
    const isDragging = React.useRef(false);
    const decided = React.useRef(false); // direction lock

    const onStart = (e) => {
        const p = e.touches ? e.touches[0] : e;
        startX.current = p.clientX;
        startY.current = p.clientY;
        isDragging.current = true;
        decided.current = false;
        setAnimating(false);
    };
    const onMove = (e) => {
        if (!isDragging.current) return;
        const p = e.touches ? e.touches[0] : e;
        const dX = p.clientX - startX.current;
        const dY = p.clientY - startY.current;
        if (!decided.current) {
            if (Math.abs(dX) < 6 && Math.abs(dY) < 6) return;
            if (Math.abs(dY) > Math.abs(dX)) {
                isDragging.current = false; // vertical scroll
                return;
            }
            decided.current = true;
        }
        // clamp; small resistance past 96
        let d = dX;
        if (d > 110) d = 110 + (d - 110) * 0.3;
        if (d < -110) d = -110 + (d + 110) * 0.3;
        setDx(d);
        if (e.cancelable && Math.abs(dX) > 12) e.preventDefault();
    };
    const onEnd = () => {
        if (!isDragging.current) {
            return;
        }
        isDragging.current = false;
        setAnimating(true);
        const threshold = 64;
        if (dx > threshold) {
            // swipe right → toggle check
            setDx(0);
            onToggle && onToggle();
        } else if (dx < -threshold) {
            // swipe left → reveal? we'll just snap and open edit
            setDx(0);
            onEdit && onEdit();
        } else {
            setDx(0);
        }
        setTimeout(() => setAnimating(false), 220);
    };

    const checked = item.checked;
    const showLeftReveal = dx > 0;
    const showRightReveal = dx < 0;

    return (
        <div style={{position: 'relative', height: 'var(--bp-row-h)', overflow: 'hidden'}}>
            {/* left reveal — check */}
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                paddingLeft: 22,
                background: showLeftReveal ? 'var(--bp-accent)' : 'transparent',
                color: '#fff', fontSize: 22,
                opacity: showLeftReveal ? Math.min(1, Math.abs(dx) / 72) : 0,
                transition: animating ? 'opacity 180ms ease' : 'none',
            }}>
                {BPIcons.check}
            </div>
            {/* right reveal — edit */}
            <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 22,
                background: showRightReveal ? 'var(--bp-warning)' : 'transparent',
                color: '#fff', fontSize: 14, fontWeight: 600, letterSpacing: 0.2,
                opacity: showRightReveal ? Math.min(1, Math.abs(dx) / 72) : 0,
                transition: animating ? 'opacity 180ms ease' : 'none',
            }}>
                EDIT
            </div>
            {/* row itself */}
            <div
                onPointerDown={onStart} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd}
                onClick={() => onToggle && onToggle()}
                style={{
                    position: 'relative', height: '100%',
                    display: 'flex', alignItems: 'center', padding: '0 14px 0 4px',
                    background: 'var(--bp-card)',
                    transform: `translateX(${dx}px)`,
                    transition: animating ? 'transform 220ms cubic-bezier(.2,.7,.2,1)' : 'none',
                    touchAction: 'pan-y',
                    cursor: 'pointer',
                    userSelect: 'none',
                }}
            >
                <BPCheck checked={checked} onClick={onToggle}/>
                <div style={{
                    flex: 1, minWidth: 0,
                    display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1,
                }}>
                    <div style={{
                        fontSize: 'var(--bp-fs)', fontWeight: 400, letterSpacing: -0.35,
                        color: checked ? 'var(--bp-sec)' : 'var(--bp-text)',
                        textDecoration: checked ? 'line-through' : 'none',
                        textDecorationColor: 'var(--bp-ter)',
                        textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden',
                        transition: 'color 180ms ease',
                    }}>
                        {item.name}
                    </div>
                    {((item.store && showStore) || (item.recurring && showRecurring)) && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontSize: 'var(--bp-fs-sub)', color: 'var(--bp-sec)', minHeight: 16,
                        }}>
                            {item.store && showStore && (
                                <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
                  <span style={{fontSize: 12, opacity: 0.7, display: 'flex'}}>{BPIcons.store}</span>
                  <span style={{textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden'}}>{item.store}</span>
                </span>
                            )}
                            {item.store && item.recurring && showStore && showRecurring && (
                                <span style={{color: 'var(--bp-ter)'}}>·</span>
                            )}
                            {item.recurring && showRecurring && (
                                <span style={{display: 'inline-flex', alignItems: 'center', gap: 4}}>
                  <span style={{fontSize: 12, opacity: 0.7, display: 'flex'}}>{BPIcons.repeat}</span>
                  <span>{item.recurring}</span>
                </span>
                            )}
                        </div>
                    )}
                </div>
                {member && member.id !== 'you' && (
                    <div style={{marginLeft: 8}}>
                        <BPAvatar member={member} size={20}/>
                    </div>
                )}
                <div style={{color: 'var(--bp-ter)', fontSize: 14, marginLeft: 8, display: 'flex'}}>{BPIcons.chev}</div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────
// Category header
// ────────────────────────────────────────────────────────────────────
function BPCategoryHeader({num, name, count, collapsed, onToggle}) {
    return (
        <button
            onClick={onToggle}
            style={{
                appearance: 'none', border: 0, background: 'transparent',
                width: '100%', textAlign: 'left',
                display: 'flex', alignItems: 'baseline', gap: 8,
                padding: '0 4px 6px',
                cursor: 'pointer',
            }}>
      <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 0.6,
          color: 'var(--bp-ter)', fontFeatureSettings: '"tnum"',
      }}>{num}</span>
            <span style={{
                fontSize: 13, fontWeight: 600, letterSpacing: 0.4,
                textTransform: 'uppercase', color: 'var(--bp-sec)',
            }}>{name}</span>
            <span style={{flex: 1}}/>
            {typeof count === 'number' && (
                <span style={{
                    fontSize: 11, fontWeight: 500,
                    color: 'var(--bp-ter)', fontFeatureSettings: '"tnum"',
                }}>{count}</span>
            )}
        </button>
    );
}

// ────────────────────────────────────────────────────────────────────
// Bottom tab bar
// ────────────────────────────────────────────────────────────────────
function BPTabBar({active, onChange}) {
    const tabs = [
        {id: 'today', label: 'Today', icon: BPIcons.cart},
        {id: 'lists', label: 'Lists', icon: BPIcons.list},
        {id: 'you', label: 'Household', icon: BPIcons.person},
    ];
    return (
        <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 30,
            paddingBottom: 22, paddingTop: 8,
            background: 'var(--bp-nav-bg)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            borderTop: '0.5px solid var(--bp-sep)',
            display: 'flex',
        }}>
            {tabs.map(t => (
                <button key={t.id} onClick={() => onChange(t.id)} style={{
                    appearance: 'none', border: 0, background: 'transparent',
                    flex: 1, padding: '6px 0 2px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    color: active === t.id ? 'var(--bp-accent)' : 'var(--bp-sec)',
                    transition: 'color 140ms ease',
                }}>
                    <span style={{fontSize: 26, display: 'flex'}}>{t.icon}</span>
                    <span style={{fontSize: 10, fontWeight: 500, letterSpacing: 0.1}}>{t.label}</span>
                </button>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────
// Top toolbar (large title + actions)
// ────────────────────────────────────────────────────────────────────
function BPToolbar({title, subtitle, leading, trailing, onBack}) {
    return (
        <div style={{
            position: 'sticky', top: 0, zIndex: 20,
            background: 'var(--bp-nav-bg)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            paddingTop: 50, paddingBottom: 8,
        }}>
            <div style={{
                display: 'flex', alignItems: 'center',
                padding: '0 12px', minHeight: 38,
            }}>
                {onBack ? (
                    <button onClick={onBack} style={{
                        appearance: 'none', border: 0, background: 'transparent', padding: 6,
                        color: 'var(--bp-accent)', display: 'flex', alignItems: 'center', gap: 2,
                        fontSize: 17, cursor: 'pointer',
                    }}>
                        <span style={{fontSize: 22, display: 'flex'}}>{BPIcons.back}</span>
                        <span style={{marginLeft: -2}}>Back</span>
                    </button>
                ) : (leading || <div style={{width: 8}}/>)}
                <div style={{flex: 1}}/>
                <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
                    {trailing}
                </div>
            </div>
            <div style={{padding: '4px 20px 0'}}>
                <div style={{
                    fontSize: 30, fontWeight: 700, color: 'var(--bp-text)',
                    letterSpacing: -0.5, lineHeight: 1.1,
                }}>{title}</div>
                {subtitle && (
                    <div style={{
                        fontSize: 13, color: 'var(--bp-sec)',
                        marginTop: 2, letterSpacing: -0.1,
                    }}>{subtitle}</div>
                )}
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────
// Toolbar pill button (round-ish)
// ────────────────────────────────────────────────────────────────────
function BPToolbarBtn({children, onClick, primary = false, ariaLabel}) {
    return (
        <button onClick={onClick} aria-label={ariaLabel} style={{
            appearance: 'none', border: 0, padding: 0, cursor: 'pointer',
            width: 34, height: 34, borderRadius: '50%',
            background: primary ? 'var(--bp-accent)' : 'var(--bp-card)',
            color: primary ? '#fff' : 'var(--bp-text)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18,
            boxShadow: 'var(--bp-shadow)',
        }}>{children}</button>
    );
}

// ────────────────────────────────────────────────────────────────────
// Card group (rounded grouped inset list)
// ────────────────────────────────────────────────────────────────────
function BPCard({children, style = {}}) {
    return (
        <div style={{
            background: 'var(--bp-card)', borderRadius: 14,
            margin: '0 16px', overflow: 'hidden',
            boxShadow: 'var(--bp-shadow)',
            ...style,
        }}>{children}</div>
    );
}

function BPCardRow({children, onClick, last = false, leading, trailing}) {
    return (
        <button onClick={onClick} style={{
            appearance: 'none', border: 0, width: '100%',
            display: 'flex', alignItems: 'center',
            padding: '12px 16px', minHeight: 48,
            background: 'transparent', color: 'var(--bp-text)',
            borderBottom: last ? 'none' : '0.5px solid var(--bp-sep)',
            cursor: onClick ? 'pointer' : 'default',
            textAlign: 'left', font: 'inherit',
            gap: 12,
        }}>
            {leading}
            <div style={{flex: 1, minWidth: 0}}>{children}</div>
            {trailing}
        </button>
    );
}

// ────────────────────────────────────────────────────────────────────
// Bottom sheet
// ────────────────────────────────────────────────────────────────────
function BPSheet({open, onClose, children, title, height = 'auto', maxHeight = '85%'}) {
    const [show, setShow] = React.useState(open);
    React.useEffect(() => {
        if (open) setShow(true);
        else {
            const t = setTimeout(() => setShow(false), 240);
            return () => clearTimeout(t);
        }
    }, [open]);
    if (!show) return null;
    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
            pointerEvents: open ? 'auto' : 'none',
        }}>
            <div onClick={onClose} style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.35)',
                opacity: open ? 1 : 0, transition: 'opacity 220ms ease',
            }}/>
            <div style={{
                position: 'relative', zIndex: 1,
                background: 'var(--bp-sheet-bg)',
                borderTopLeftRadius: 18, borderTopRightRadius: 18,
                maxHeight, height,
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.25)',
                transform: open ? 'translateY(0)' : 'translateY(100%)',
                transition: 'transform 280ms cubic-bezier(.2,.7,.2,1)',
                paddingBottom: 28,
            }}>
                <div style={{display: 'flex', justifyContent: 'center', paddingTop: 8}}>
                    <div style={{width: 36, height: 5, borderRadius: 3, background: 'var(--bp-sep-strong)'}}/>
                </div>
                {title && (
                    <div style={{
                        padding: '12px 20px 8px', fontSize: 17, fontWeight: 600,
                        color: 'var(--bp-text)', letterSpacing: -0.2,
                    }}>{title}</div>
                )}
                <div style={{overflow: 'auto', flex: 1}}>{children}</div>
            </div>
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────
// Segmented control
// ────────────────────────────────────────────────────────────────────
function BPSegmented({value, options, onChange, fullWidth = true}) {
    return (
        <div style={{
            display: 'flex', padding: 2, borderRadius: 9,
            background: 'var(--bp-bg2)',
            width: fullWidth ? '100%' : 'auto',
        }}>
            {options.map(o => {
                const v = typeof o === 'string' ? o : o.value;
                const l = typeof o === 'string' ? o : o.label;
                const active = v === value;
                return (
                    <button key={v} onClick={() => onChange(v)} style={{
                        appearance: 'none', border: 0, padding: '6px 12px',
                        background: active ? 'var(--bp-card)' : 'transparent',
                        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        color: 'var(--bp-text)', flex: 1, fontSize: 13, fontWeight: 500,
                        borderRadius: 7, cursor: 'pointer', letterSpacing: -0.1,
                        transition: 'background 140ms ease, box-shadow 140ms ease',
                    }}>{l}</button>
                );
            })}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────
// Text input (iOS-style)
// ────────────────────────────────────────────────────────────────────
function BPInput({value, onChange, placeholder, autoFocus, type = 'text'}) {
    return (
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
            style={{
                appearance: 'none', border: 0, outline: 'none',
                background: 'transparent', color: 'var(--bp-text)',
                fontSize: 17, padding: '10px 0', width: '100%',
                letterSpacing: -0.2,
                fontFamily: 'inherit',
            }}
        />
    );
}

// ────────────────────────────────────────────────────────────────────
// Search field
// ────────────────────────────────────────────────────────────────────
function BPSearch({value, onChange, placeholder = 'Search items'}) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--bp-bg2)', borderRadius: 10,
            padding: '6px 10px', margin: '0 16px 10px',
        }}>
            <span style={{color: 'var(--bp-sec)', fontSize: 16, display: 'flex'}}>{BPIcons.search}</span>
            <input
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                    appearance: 'none', border: 0, outline: 'none',
                    background: 'transparent', color: 'var(--bp-text)',
                    fontSize: 16, padding: '4px 0', flex: 1,
                    fontFamily: 'inherit',
                }}
            />
            {value && (
                <button onClick={() => onChange('')} style={{
                    appearance: 'none', border: 0, background: 'transparent',
                    color: 'var(--bp-ter)', fontSize: 16, padding: 0, cursor: 'pointer',
                    display: 'flex',
                }}>{BPIcons.clear}</button>
            )}
        </div>
    );
}

Object.assign(window, {
    BPIcons, BPAvatar, BPCheck, BPItemRow, BPCategoryHeader,
    BPTabBar, BPToolbar, BPToolbarBtn, BPCard, BPCardRow,
    BPSheet, BPSegmented, BPInput, BPSearch,
});
