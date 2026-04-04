import { createRoot } from 'react-dom/client';
import App from './App';
import './globals.css';

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
