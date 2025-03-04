import React from 'react';
import { render, screen } from '@testing-library/react';
import ARVideoFeed from './ARVideoFeed';

test('renders ARVideoFeed component', () => {
    render(<ARVideoFeed />);
    const linkElement = screen.getByText(/AR Video Feed/i);
    expect(linkElement).toBeInTheDocument();
});