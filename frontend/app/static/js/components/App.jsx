import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import Settings from './Settings';

const App = () => {
    return (
        <div className="app">
            <Header />
            <div className="content-wrapper">
                <Sidebar />
                <Settings />
            </div>
        </div>
    );
};

export default App;