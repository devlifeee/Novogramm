import React, { useRef } from 'react';

const AvatarModal = ({ onClose, onAvatarChange }) => {
    const fileInputRef = useRef(null);

    const handleFileSelect = () => {
        fileInputRef.current.click();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Изменить аватар</h2>
                    <button className="close-btn" onClick={onClose}>
                        <i className="fas fa-times"></i>
                    </button>
                </div>
                <div className="modal-body">
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ display: 'none' }}
                        accept="image/*"
                        onChange={onAvatarChange}
                    />
                    <button className="btn-primary" onClick={handleFileSelect}>
                        Выбрать файл
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AvatarModal;