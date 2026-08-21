import { useState } from 'react';

/* Password field with a show/hide eye. type="button" on the toggle matters —
   a bare <button> inside a form defaults to submit. */
function PasswordInput({
    value,
    onChange,
    placeholder,
    autoComplete = 'current-password',
    required = true,
    id,
}) {
    const [visible, setVisible] = useState(false);
    const label = visible ? 'Hide password' : 'Show password';

    return (
        <div className="password-field">
            <input
                id={id}
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                autoComplete={autoComplete}
                required={required}
            />
            <button
                type="button"
                className="password-toggle"
                onClick={() => setVisible((shown) => !shown)}
                title={label}
                aria-label={label}
                aria-pressed={visible}
                tabIndex={-1}
            >
                <i className={`fa-solid ${visible ? 'fa-eye-slash' : 'fa-eye'}`}></i>
            </button>
        </div>
    );
}

export default PasswordInput;
