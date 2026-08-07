/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Admin from './pages/Admin';
import AutomationRules from './pages/AutomationRules';
import ChecklistConfig from './pages/ChecklistConfig';
import Clients from './pages/Clients';
import CustomFieldsConfig from './pages/CustomFieldsConfig';
import Dashboard from './pages/Dashboard';
import DynamicFormConfig from './pages/DynamicFormConfig';
import EmailAutomationConfig from './pages/EmailAutomationConfig';
import EscalationSettings from './pages/EscalationSettings';
import KanbanConfig from './pages/KanbanConfig';
import KnowledgeBase from './pages/KnowledgeBase';
import KnowledgeBaseSettings from './pages/KnowledgeBaseSettings';
import KnowledgeCategoryConfig from './pages/KnowledgeCategoryConfig';
import NotificationSettings from './pages/NotificationSettings';
import Reports from './pages/Reports';
import ResponseTemplates from './pages/ResponseTemplates';
import Settings from './pages/Settings';
import Suporte from './pages/Suporte';
import SuporteSettings from './pages/SuporteSettings';
import SystemSettings from './pages/SystemSettings';
import TicketDetail from './pages/TicketDetail';
import TicketTypeConfig from './pages/TicketTypeConfig';
import Tickets from './pages/Tickets';
import Users from './pages/Users';
import VerticalConfig from './pages/VerticalConfig';
import WebhookDocs from './pages/WebhookDocs';
import Agenda from './pages/Agenda';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Admin": Admin,
    "AutomationRules": AutomationRules,
    "ChecklistConfig": ChecklistConfig,
    "Clients": Clients,
    "CustomFieldsConfig": CustomFieldsConfig,
    "Dashboard": Dashboard,
    "DynamicFormConfig": DynamicFormConfig,
    "EmailAutomationConfig": EmailAutomationConfig,
    "EscalationSettings": EscalationSettings,
    "KanbanConfig": KanbanConfig,
    "KnowledgeBase": KnowledgeBase,
    "KnowledgeBaseSettings": KnowledgeBaseSettings,
    "KnowledgeCategoryConfig": KnowledgeCategoryConfig,
    "NotificationSettings": NotificationSettings,
    "Reports": Reports,
    "ResponseTemplates": ResponseTemplates,
    "Settings": Settings,
    "Suporte": Suporte,
    "SuporteSettings": SuporteSettings,
    "SystemSettings": SystemSettings,
    "TicketDetail": TicketDetail,
    "TicketTypeConfig": TicketTypeConfig,
    "Tickets": Tickets,
    "Users": Users,
    "VerticalConfig": VerticalConfig,
    "WebhookDocs": WebhookDocs,
    "Agenda": Agenda,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};