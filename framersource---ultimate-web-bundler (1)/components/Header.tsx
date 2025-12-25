
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="py-4 text-center">
      <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-2">
        Site<span className="gradient-text">Scraper</span>
      </h1>
      <p className="text-gray-500 text-sm font-medium tracking-wide uppercase">
        Single-File Website Bundler
      </p>
    </header>
  );
};

export default Header;
