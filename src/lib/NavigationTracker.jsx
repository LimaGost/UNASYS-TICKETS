import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { api } from '@/api/apiClient';
import { pagesConfig } from '@/pages.config';
import { openTab } from '@/hooks/useTabs';
import { PAGE_LABELS, lastClosedTabId, lastClosedTimestamp } from '@/components/TabBar';

export default function NavigationTracker() {
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const { Pages, mainPage } = pagesConfig;
    const mainPageKey = mainPage ?? Object.keys(Pages)[0];

    // Log user activity when navigating to a page + open tab
    useEffect(() => {
        const pathname = location.pathname;
        let pageName;

        if (pathname === '/' || pathname === '') {
            pageName = mainPageKey;
        } else {
            const pathSegment = pathname.replace(/^\//, '').split('/')[0];
            const pageKeys = Object.keys(Pages);
            const matchedKey = pageKeys.find(
                key => key.toLowerCase() === pathSegment.toLowerCase()
            );
            pageName = matchedKey || null;
        }

        if (isAuthenticated && pageName) {
            api.appLogs.logUserInApp(pageName).catch(() => {});
        }

        // Auto-open tab for current path with dynamic label for tickets
        if (isAuthenticated) {
            const segments = pathname.split('/').filter(Boolean);
            
            // Don't reopen a tab that was just closed (within 2 seconds)
            const recentlyClosed = lastClosedTabId && 
                                   (Date.now() - lastClosedTimestamp) < 2000;
            if (recentlyClosed) return;
            
            // Check if it's a TicketDetail page
            if (pathname.includes('/ticket/') && segments.length >= 2) {
                const ticketId = segments[segments.length - 1];
                const id = '/ticket/' + ticketId;

                api.entities.Ticket.get(ticketId).then(ticket => {
                    if (ticket) {
                        const num = ticket.ticket_number
                            ? `#${String(ticket.ticket_number).padStart(4, '0')}`
                            : '';
                        const rawTitle = (ticket.title || 'Ticket').trim();
                        const shortTitle = rawTitle.length > 22 ? rawTitle.slice(0, 22) + '…' : rawTitle;
                        const label = num ? `${num} · ${shortTitle}` : shortTitle;
                        openTab({ id, label, path: id });
                    }
                }).catch(() => {
                    openTab({ id, label: 'Ticket', path: id });
                });
            } else {
                // Regular pages
                let label = PAGE_LABELS[pathname];
                if (!label) {
                    const entry = Object.entries(PAGE_LABELS).find(([k]) => k !== '/' && pathname.startsWith(k + '/'));
                    label = entry?.[1];
                }
                if (!label) label = pageName || decodeURIComponent(pathname.replace(/^\//, '').replace(/\//g, ' / ')) || 'Página';

                const id = segments.length >= 2 ? '/' + segments.slice(0, 2).join('/') : pathname || '/';
                openTab({ id, label, path: id });
            }
        }
    }, [location, isAuthenticated, Pages, mainPageKey]);

    return null;
}