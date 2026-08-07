import { useState, useEffect } from "react";

const STORAGE_KEY = "app_open_tabs";
const MAX_TABS = 20;

function loadTabs() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTabs(tabs) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  } catch {}
}

let _tabs = loadTabs();
let _listeners = [];

function notify() {
  _listeners.forEach(fn => fn([..._tabs]));
}

export function openTab(tab) {
  const existing = _tabs.findIndex(t => t.id === tab.id);
  if (existing !== -1) {
    _tabs[existing] = { ..._tabs[existing], ...tab };
  } else {
    if (_tabs.length >= MAX_TABS) {
      const idx = _tabs.findIndex(t => !t.pinned);
      if (idx !== -1) _tabs.splice(idx, 1);
    }
    _tabs = [..._tabs, tab];
  }
  saveTabs(_tabs);
  notify();
}

export function closeTab(id) {
  _tabs = _tabs.filter(t => t.id !== id);
  saveTabs(_tabs);
  notify();
}

export function closeAllTabs() {
  _tabs = [];
  saveTabs(_tabs);
  notify();
}

export function useTabs() {
  const [tabs, setTabs] = useState([..._tabs]);

  useEffect(() => {
    _listeners.push(setTabs);
    return () => {
      _listeners = _listeners.filter(fn => fn !== setTabs);
    };
  }, []);

  return { tabs, openTab, closeTab, closeAllTabs };
}