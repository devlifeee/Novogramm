import React from 'react';

const Sidebar = ({ activePage, setActivePage }) => {
    // Получаем URL из глобальной переменной
    const urls = window.APP_URLS || {};
    
    return (
        <aside className="sidebar">
             <div className="header-logo">
                <img src="/static/images/лого.jpg" alt="Логотип Novogramm"/>
                    <div className="Logo">
                        <p>Novogramm</p>
                    </div>
                </div>
            <nav className="nav-menu">
                <a href={urls.home} className="nav-item">
                    <i className="fas fa-home"></i>
                    <span>Главная</span>
                </a>
                <a href={urls.chats} className="nav-item">
                    <i className="fas fa-comment-dots"></i>
                    <span>Чаты</span>
                </a>
                <a href={urls.programming_mode} className="nav-item">
                    <i className="fas fa-laptop-code"></i> 
                    <span>Programming mode</span>
                </a>
                <a href={urls.settings} className="nav-item active">
                    <i className="fas fa-cog"></i>
                    <span>Настройки</span>
                </a>         
            </nav>
        </aside>
    );
};

export default Sidebar;