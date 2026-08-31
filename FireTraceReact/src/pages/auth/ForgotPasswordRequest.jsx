import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import '../../style.css';

function ForgotPasswordRequest() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        if (!email) {
            setError('Please enter your email address');
            return;
        }
        
        setSubmitting(true);
        try {
            // Here you would call your API to verify the email
            // For now, we'll just proceed to the next step
            navigate('/forgotpass2');
        } catch {
            setError('Error processing request. Please try again.');
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
                        <span className="auth-header-title">Forgot Password</span>
                    </Link>
                </header>

                <div className="auth-description">
                    <p>Enter your email address and we'll send you instructions to reset your password.</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-fields">
                        <div className="input-group">
                            <label className="label">Email Address</label>
                            <input 
                                type="email" 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                placeholder="Enter your email"
                                required 
                            />
                        </div>

                        {error && <p className="auth-error">{error}</p>}
                    </div>

                    <div className="form-actions">
                        <button className="create-button" type="submit" disabled={submitting}>
                            {submitting ? 'Processing…' : 'Continue'}
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

export default ForgotPasswordRequest;