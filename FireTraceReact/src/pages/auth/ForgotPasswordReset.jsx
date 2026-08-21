import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../style.css';
import PasswordInput from '../../components/PasswordInput';

function ForgotPasswordReset() {
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!newPassword || !confirmPassword) {
            setError('Both password fields are required');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setSubmitting(true);
        try {
            // Here you would call your API to reset the password
            // For now, we'll just proceed to login
            navigate('/login');
        } catch (err) {
            setError('Error resetting password. Please try again.');
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <center className="auth-page">
            <div className="auth-form-container">
                <header className="auth-header">
                    <Link to="/login" className="auth-back-link">
                        <span className="back-arrow">←</span>
                        <span className="auth-header-title">Reset Password</span>
                    </Link>
                </header>

                <div className="auth-description">
                    <p>Create a new password for your account. Make sure it's secure and different from before.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-fields">
                        <div className="input-group">
                            <label className="label">New Password</label>
                            <PasswordInput
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="Enter new password"
                                autoComplete="new-password"
                            />
                        </div>

                        <div className="input-group">
                            <label className="label">Confirm Password</label>
                            <PasswordInput
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Confirm your password"
                                autoComplete="new-password"
                            />
                        </div>

                        {error && <p className="auth-error">{error}</p>}
                    </div>

                    <div className="form-actions">
                        <button className="create-button" type="submit" disabled={submitting}>
                            {submitting ? 'Resetting…' : 'Reset Password'}
                        </button>
                    </div>
                </form>

                <p className="auth-footer">
                    <Link className="auth-footer-link" to="/login">Back to Sign In</Link>
                </p>
            </div>
        </center>
    );
}

export default ForgotPasswordReset;