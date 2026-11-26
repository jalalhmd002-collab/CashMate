    const DEFAULT_WALLETS = ["كاش", "بنك", "محفظة", "جوال باي"];
    const DEFAULT_EXPENSE_CATEGORIES = [
        "تكاليف مدارس",
        "مواصلات ووقود",
        "بقالة وتموين",
        "كهرباء ومياه",
        "صيانة عامة",
        "إيجار ومستلزمات",
        "مصاريف شخصية",
        "فواتير واتصالات"
    ];
    const DEFAULT_INCOME_CATEGORIES = [
        "راتب العمل",
        "مبيعات",
        "خدمات زبائن",
        "إيراد إضافي",
        "أرباح تجارة",
        "مبيعات زبائن",
        "سداد ديون"
    ];

    const NEON_PALETTE_ITEMS = [
        { color: "#6366F1", text: "#6366F1", name: "نيلي كهربائي" },
        { color: "#EC4899", text: "#EC4899", name: "وردي صاخب" },
        { color: "#06B6D4", text: "#06B6D4", name: "سماوي مشرق" },
        { color: "#10B981", text: "#10B981", name: "زمردي" },
        { color: "#F59E0B", text: "#F59E0B", name: "كهرماني" },
        { color: "#F43F5E", text: "#F43F5E", name: "قرمزي" },
        { color: "#8B5CF6", text: "#8B5CF6", name: "بنفسجي" },
        { color: "#0EA5E9", text: "#0EA5E9", name: "أزرق سماوي" },
        { color: "#D946EF", text: "#D946EF", name: "فوشيا" },
        { color: "#84CC16", text: "#84CC16", name: "ليموني" }
    ];

    /* ======================================================================
       إدارة القائمة الجانبية القابلة للطي وشريط الإدخال العائم
       ====================================================================== */
    let quickComposerType = "EXPENSE";

    function toggleSidebarState() {
        const sidebar = document.getElementById("appSidebar");
        if (!sidebar) return;
        if (window.innerWidth <= 768) {
            closeMobileSidebar();
            return;
        }
        const isCollapsed = sidebar.classList.toggle("is-collapsed");
        try { localStorage.setItem("app_sidebar_collapsed_v1", isCollapsed ? "1" : "0"); } catch(e) {}
    }

    function openMobileSidebar() {
        const sidebar = document.getElementById("appSidebar");
        const bd = document.getElementById("sidebarBackdropMobile");
        if (sidebar) sidebar.classList.add("is-mobile-open");
        if (bd) bd.classList.add("is-visible");
        pushAppHistoryStep("mobile_sidebar");
    }

    function closeMobileSidebar() {
        const sidebar = document.getElementById("appSidebar");
        const bd = document.getElementById("sidebarBackdropMobile");
        if (sidebar) sidebar.classList.remove("is-mobile-open");
        if (bd) bd.classList.remove("is-visible");
    }

    function syncSidebarActiveItem(activeId) {
        ["sideNavExpense", "sideNavIncome", "sideNavClients", "sideNavHistory"].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle("is-active", id === activeId);
        });
    }

    function toggleQuickComposerType() {
        quickComposerType = quickComposerType === "EXPENSE" ? "INCOME" : "EXPENSE";
        const btn = document.getElementById("quickComposerTypeBtn");
        const dot = document.getElementById("quickComposerTypeDot");
        const lbl = document.getElementById("quickComposerTypeLabel");
        if (!btn || !dot || !lbl) return;
        if (quickComposerType === "INCOME") {
            btn.classList.remove("is-expense");
            btn.classList.add("is-income");
            dot.classList.remove("red");
            dot.classList.add("green");
            lbl.innerText = "دخل";
        } else {
            btn.classList.remove("is-income");
            btn.classList.add("is-expense");
            dot.classList.remove("green");
            dot.classList.add("red");
            lbl.innerText = "مصروف";
        }
    }

    function submitQuickComposerTransaction() {
        const amtInp = document.getElementById("quickComposerAmount");
        const catInp = document.getElementById("quickComposerCategory");
        const amount = parseNumberSafe(amtInp ? amtInp.value : "", NaN);
        const category = (catInp ? catInp.value : "").trim();
        const wallet = modalSelectedWallet || (paymentWallets[0] || "كاش");
        const date = formatISODate(new Date());

        if (isNaN(amount) || amount <= 0) {
            displayToast("يرجى إدخال مبلغ صحيح في الشريط السريع", true);
            if (amtInp) amtInp.focus();
            return;
        }
        if (!category) {
            displayToast("يرجى كتابة التصنيف أو البيان", true);
            if (catInp) catInp.focus();
            return;
        }

        const saveCallback = () => {
            registerNewCategoryIfMissing(category, quickComposerType);
            allTransactions.unshift({
                id: Date.now(),
                amount,
                wallet,
                category,
                type: quickComposerType,
                date,
                note: ""
            });

            saveStorage();
            if (amtInp) amtInp.value = "";
            if (catInp) catInp.value = "";
            displayToast("تم حفظ الحركة بنجاح");
            renderMainState();
        };

        if (quickComposerType === "EXPENSE") {
            const availBal = getWalletBalance(wallet, null);
            if (normalizeWalletName(wallet) !== "كاش") {
                if (availBal <= 0) {
                    displayToast(`لا يمكن الصرف من وسيلة (${wallet})؛ رصيدها فارغ (0.00)!`, true);
                    return;
                }
                if (amount > availBal) {
                    displayToast(`المبلغ المطلوب أكبر من الرصيد المتوفر في (${wallet}) وهو (${availBal.toLocaleString('en-US', {maximumFractionDigits: 2})})!`, true);
                    return;
                }
            } else if (amount > availBal) {
                promptConfirmDialog(
                    "تنبيه: الصرف بالدَّين من الكاش",
                    "رصيد الكاش المتوفر (" + availBal.toLocaleString('en-US', {maximumFractionDigits: 2}) + ") أقل من المبلغ المطلوب. سيصبح رصيد الكاش (" + (Math.round((availBal - amount) * 100) / 100).toLocaleString('en-US', {maximumFractionDigits: 2}) + ") كعجز على الصندوق. هل تريد المتابعة؟",
                    saveCallback,
                    false,
                    "متابعة"
                );
                return;
            }
        }

        saveCallback();
    }

    // أدوات معالجة الأرقام والنصوص والأمان
    function normalizeArabicText(str) {
        if (!str) return "";
        return normalizeArabicNumbers(String(str))
            .replace(/[\u064B-\u065F\u0670]/g, "")
            .replace(/[أإآ]/g, "ا")
            .replace(/ة/g, "ه")
            .replace(/ى/g, "ي")
            .toLowerCase()
            .trim();
    }

    function normalizeArabicNumbers(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/[٠۰]/g, '0')
            .replace(/[١۱]/g, '1')
            .replace(/[٢۲]/g, '2')
            .replace(/[٣۳]/g, '3')
            .replace(/[٤۴]/g, '4')
            .replace(/[٥۵]/g, '5')
            .replace(/[٦۶]/g, '6')
            .replace(/[٧۷]/g, '7')
            .replace(/[٨۸]/g, '8')
            .replace(/[٩۹]/g, '9')
            .replace(/٫/g, '.')
            .replace(/,/g, '');
    }

    function parseNumberSafe(val, defaultVal = 0) {
        if (val === null || val === undefined) return defaultVal;
        const clean = normalizeArabicNumbers(val).replace(/,/g, "").trim();
        if (!clean) return defaultVal;
        const num = parseFloat(clean);
        return isNaN(num) ? defaultVal : num;
    }

    function escapeHTML(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    const UnifiedStorage = {
        _db: null,
        getDB: function(callback) {
            if (this._db) {
                if (callback) callback(this._db);
                return;
            }
            if (!window.indexedDB) {
                if (callback) callback(null);
                return;
            }
            try {
                const req = window.indexedDB.open("finances_unified_db", 2);
                req.onupgradeneeded = function(e) {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains("kv_store")) {
                        db.createObjectStore("kv_store", { keyPath: "k" });
                    }
                };
                req.onsuccess = function(e) {
                    UnifiedStorage._db = e.target.result;
                    if (callback) callback(UnifiedStorage._db);
                };
                req.onerror = function() {
                    if (callback) callback(null);
                };
            } catch(e) {
                if (callback) callback(null);
            }
        },
        save: function(key, data) {
            const jsonStr = JSON.stringify(data);
            try { localStorage.setItem(key, jsonStr); } catch(e) {}
            try { sessionStorage.setItem(key, jsonStr); } catch(e) {}
            this.saveToIDB(key, data);
        },
        load: function(key) {
            try {
                const ls = localStorage.getItem(key);
                if (ls !== null && ls !== undefined && ls !== "") return JSON.parse(ls);
            } catch(e) {}
            if (key.includes("app_finances_data")) {
                const fallbacks = ["app_finances_data_v17", "app_finances_data_v16", "app_finances_data_v15", "app_finances_data"];
                for (let k of fallbacks) {
                    try {
                        const l = localStorage.getItem(k);
                        if (l) return JSON.parse(l);
                    } catch(e) {}
                }
            }
            try {
                const ss = sessionStorage.getItem(key);
                if (ss !== null && ss !== undefined && ss !== "") return JSON.parse(ss);
            } catch(e) {}
            return null;
        },
        saveToIDB: function(key, val) {
            this.getDB(function(db) {
                if (!db) return;
                try {
                    const tx = db.transaction("kv_store", "readwrite");
                    tx.objectStore("kv_store").put({ k: key, v: val });
                } catch(err) {}
            });
        },
        loadAllFromIDB: function(callback) {
            this.getDB(function(db) {
                if (!db) {
                    if (typeof callback === "function") callback({});
                    return;
                }
                try {
                    const tx = db.transaction("kv_store", "readonly");
                    const store = tx.objectStore("kv_store");
                    const getAllReq = store.getAll();
                    getAllReq.onsuccess = function() {
                        const items = getAllReq.result || [];
                        const dataMap = {};
                        items.forEach(it => { dataMap[it.k] = it.v; });
                        if (typeof callback === "function") callback(dataMap);
                    };
                    getAllReq.onerror = function() {
                        if (typeof callback === "function") callback({});
                    };
                } catch(err) {
                    if (typeof callback === "function") callback({});
                }
            });
        }
    };

    let allTransactions = [];
    let clientTransactions = [];
    let archivedClients = [];
    let paymentWallets = [];
    let savedExpenseCategories = [];
    let savedIncomeCategories = [];
    let savedClients = [];
    let currentMainType = "EXPENSE";
    let modalActiveTxType = "EXPENSE";
    let modalSelectedWallet = "كاش";
    let activePeriodKey = "day";
    let activeRefDate = new Date();
    let customPickedStartDate = formatISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    let customPickedEndDate = formatISODate(new Date());
    let selectedHistoryWallet = "ALL";
    let selectedHistoryCategory = null;
    let editingRecordId = null;
    let editingInvoiceId = null;
    let editingPaymentId = null;
    let openActionDropdownId = null;
    let pendingConfirmCallback = null;
    let activeStatementClient = null;
    let clientsSubFilter = 'ALL';
    let customAppTitle = "";

    function normalizeWalletName(w) {
        const clean = String(w || "").trim();
        if (clean === "القبض الكاش") return "كاش";
        if (clean === "بنك فلسطين") return "بنك";
        if (clean === "محفظة بنك") return "محفظة";
        return clean;
    }

    function normalizeWalletList(list) {
        if (!Array.isArray(list)) return [...DEFAULT_WALLETS];
        const out = [];
        list.forEach(w => {
            const nw = normalizeWalletName(w);
            if (nw && !out.includes(nw)) out.push(nw);
        });
        return out.length > 0 ? out : [...DEFAULT_WALLETS];
    }

    function getWalletBalance(walletName, excludeTxId = null) {
        let bal = 0;
        for (let i = 0; i < allTransactions.length; i++) {
            const t = allTransactions[i];
            if (excludeTxId != null && t.id == excludeTxId) continue;
            const targetNormW = normalizeWalletName(walletName);
            if (normalizeWalletName(t.wallet) === targetNormW) {
                const amt = Number(t.amount) || 0;
                if (t.type === "INCOME") bal += amt;
                else if (t.type === "EXPENSE") bal -= amt;
            }
        }
        for (let i = 0; i < clientTransactions.length; i++) {
            const t = clientTransactions[i];
            if (excludeTxId != null && t.id == excludeTxId) continue;
            const targetNormW = normalizeWalletName(walletName);
            if (normalizeWalletName(t.wallet) === targetNormW) {
                const amt = Number(t.amount) || 0;
                if (amt > 0) bal += amt;
            }
        }
        return Math.round(bal * 100) / 100;
    }

    function setCaretToEnd(el) {
        if (!el) return;
        setTimeout(function() {
            try {
                const len = (el.value || "").length;
                if (el.setSelectionRange) el.setSelectionRange(len, len);
            } catch(e) {}
        }, 20);
    }

    function handleInputAutoSelect(el) {
        if (!el) return;
        setCaretToEnd(el);
    }

    function handleNumberInputFocus(el) {
        if (!el) return;
        closeCategoryDropdown();
        const val = String(el.value || "").trim();
        if (val === "0" || val === "0.00" || val === "0.0" || val === "00") {
            el.value = "";
        } else if (val.length > 0) {
            setCaretToEnd(el);
        }
    }

    function formatNumberWithCommas(rawVal) {
        let sanitized = normalizeArabicNumbers(rawVal).replace(/[^0-9.]/g, "");
        if (!sanitized) return "";
        const firstDot = sanitized.indexOf(".");
        let intPart = sanitized;
        let decPart = "";
        let hasDot = false;
        if (firstDot !== -1) {
            hasDot = true;
            intPart = sanitized.slice(0, firstDot);
            decPart = sanitized.slice(firstDot + 1).replace(/\./g, "");
        }
        if (/^0[0-9]/.test(intPart)) {
            intPart = intPart.replace(/^0+(?=[0-9])/, "");
        }
        if (hasDot && intPart === "") intPart = "0";
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return hasDot ? `${formattedInt}.${decPart}` : formattedInt;
    }

    function handleNumberInputInput(el) {
        if (!el) return;
        const raw = String(el.value || "");
        const selStart = typeof el.selectionStart === "number" ? el.selectionStart : raw.length;
        const meaningfulBefore = normalizeArabicNumbers(raw.slice(0, selStart)).replace(/[^0-9.]/g, "").length;

        const formatted = formatNumberWithCommas(raw);
        if (formatted !== el.value) {
            el.value = formatted;
            if (typeof el.setSelectionRange === "function") {
                let count = 0;
                let newPos = 0;
                while (newPos < formatted.length && count < meaningfulBefore) {
                    if (/[0-9.]/.test(formatted[newPos])) count++;
                    newPos++;
                }
                try { el.setSelectionRange(newPos, newPos); } catch (err) {}
            }
        }
        if (el.id === "invTotalAmount" || el.id === "invPaidAmount") recalcInvoiceDebtPreview();
    }

    document.addEventListener("keydown", function(e) {
        const el = e.target;
        if (!el || el.tagName !== "INPUT" || el.getAttribute("inputmode") !== "decimal") return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const navKeys = ["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
        if (navKeys.includes(e.key)) return;
        if (/^[0-9\u0660-\u0669\u06F0-\u06F9]$/.test(e.key)) return;
        if (e.key === "." && !String(el.value || "").includes(".")) return;
        e.preventDefault();
    });

    document.addEventListener("paste", function(e) {
        const el = e.target;
        if (el && el.tagName === "INPUT" && el.getAttribute("inputmode") === "decimal") {
            setTimeout(() => handleNumberInputInput(el), 0);
        }
    });

    function handleCategoryInputFocus(el) {
        if (!el) return;
        setCaretToEnd(el);
        openCategoryDropdown();
    }

    function toggleActionMenu(event, txId) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const btn = event.currentTarget || event.target;
        const wrapper = btn.closest(".action-dropdown-wrapper");
        if (!wrapper) return;
        const targetMenu = wrapper.querySelector(".action-dropdown-menu");
        if (!targetMenu) return;

        const wasOpen = targetMenu.classList.contains("is-open");
        closeAllActionMenus();
        if (!wasOpen) {
            targetMenu.classList.add("is-open");
            const parentCard = wrapper.closest(".unified-tx-card, .stream-record-card");
            if (parentCard) parentCard.classList.add("has-open-menu");
            if (!btn.closest(".glass-modal-backdrop")) {
                const bd = document.getElementById("actionMenuBackdrop");
                if (bd) bd.classList.add("is-active");
            }
            openActionDropdownId = txId;
        }
    }

    function closeAllActionMenus() {
        document.querySelectorAll(".action-dropdown-menu.is-open").forEach(m => m.classList.remove("is-open"));
        document.querySelectorAll(".has-open-menu").forEach(c => c.classList.remove("has-open-menu"));
        const bd = document.getElementById("actionMenuBackdrop");
        if (bd) bd.classList.remove("is-active");
        openActionDropdownId = null;
    }

    function onActionMenuEdit(txId) {
        closeAllActionMenus();
        beginEditTx(txId);
    }

    function onActionMenuDelete(txId) {
        closeAllActionMenus();
        confirmDeleteTx(txId);
    }

    window.toggleActionMenu = toggleActionMenu;
    window.closeAllActionMenus = closeAllActionMenus;
    window.onActionMenuEdit = onActionMenuEdit;
    window.onActionMenuDelete = onActionMenuDelete;

    function handleAppTitleChange(val) {
        customAppTitle = val;
        UnifiedStorage.save("app_custom_title_v1", val);
        updateAppTitleDisplay();
        pushCloudSync();
    }

    function updateAppTitleDisplay() {
        const disp = document.getElementById("headerAppTitleDisplay");
        const inp = document.getElementById("appTitleSettingInput");
        if (disp) disp.innerText = customAppTitle || "إدارة الأموال والمصاريف";
        if (inp && inp.value !== customAppTitle) inp.value = customAppTitle;
    }

    function migrateClientTransactionsIfNeeded() {
        const legacyClients = allTransactions.filter(t => t && t.client);
        if (legacyClients.length > 0) {
            const existingIds = new Set(clientTransactions.map(c => String(c.id)));
            legacyClients.forEach(c => {
                if (!existingIds.has(String(c.id))) clientTransactions.push(c);
            });
            allTransactions = allTransactions.filter(t => t && !t.client);
            UnifiedStorage.save("app_finances_data_v17", allTransactions);
            UnifiedStorage.save("app_client_transactions_v1", clientTransactions);
        }
    }

    function persistAllDataOnly() {
        UnifiedStorage.save("app_finances_data_v17", allTransactions);
        UnifiedStorage.save("app_client_transactions_v1", clientTransactions);
        UnifiedStorage.save("app_payment_wallets_v17", paymentWallets);
        UnifiedStorage.save("app_expense_categories_v18", savedExpenseCategories);
        UnifiedStorage.save("app_income_categories_v18", savedIncomeCategories);
        UnifiedStorage.save("app_saved_clients_v18", savedClients);
        UnifiedStorage.save("app_archived_clients_v17", archivedClients);
        if (customAppTitle !== undefined) UnifiedStorage.save("app_custom_title_v1", customAppTitle);
        UnifiedStorage.save("app_lock_password_v1", appLockPassword || "");
        UnifiedStorage.save("delete_password_v1", deletePassword || "");
    }

    function autoSaveAllState() {
        persistAllDataOnly();
    }

    function applySlateTheme(isSlate, persist = true) {
        document.documentElement.classList.toggle("slate-mode", isSlate);
        document.body.classList.toggle("slate-mode", isSlate);
        const themeColor = isSlate ? "#22252A" : "#F7F7F5";
        const themeMeta = document.getElementById("theme-color-meta") || document.querySelector('meta[name="theme-color"]');
        if (themeMeta) {
            themeMeta.setAttribute("content", themeColor);
        }
        const iconSlot = document.getElementById("slateThemeIconSlot");
        const labelSlot = document.getElementById("slateThemeLabelSlot");
        if (iconSlot) {
            iconSlot.innerHTML = isSlate
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
        }
        if (labelSlot) {
            labelSlot.innerText = isSlate ? "الوضع الفاتح" : "الوضع السكني الليلي";
        }
        if (persist) {
            try { localStorage.setItem("cashmate_theme", isSlate ? "slate" : "light"); } catch (e) {}
        }
    }

    function toggleSlateTheme() {
        const nextIsSlate = !document.body.classList.contains("slate-mode");
        applySlateTheme(nextIsSlate, true);
    }

    function initSavedTheme() {
        let saved = "light";
        try { saved = localStorage.getItem("cashmate_theme") || "light"; } catch (e) {}
        applySlateTheme(saved === "slate", false);
    }

    function initApplication() {
        initSavedTheme();
        preloadAllCustomerAvatars();
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
        }

        try {
            if (localStorage.getItem("app_sidebar_collapsed_v1") === "1" && window.innerWidth > 768) {
                const sb = document.getElementById("appSidebar");
                if (sb) sb.classList.add("is-collapsed");
            }
        } catch(e) {}

        const storedExpCats = UnifiedStorage.load("app_expense_categories_v18");
        if (Array.isArray(storedExpCats) && storedExpCats.length > 0) {
            savedExpenseCategories = storedExpCats;
        } else {
            const legacyCats = UnifiedStorage.load("app_user_categories_v17");
            if (Array.isArray(legacyCats) && legacyCats.length > 0) {
                savedExpenseCategories = legacyCats.filter(c => !["راتب العمل", "مبيعات", "خدمات زبائن", "إيراد إضافي", "أرباح تجارة", "مبيعات زبائن", "سداد ديون"].includes(c));
            }
            if (!savedExpenseCategories || savedExpenseCategories.length === 0) {
                savedExpenseCategories = [...DEFAULT_EXPENSE_CATEGORIES];
            }
        }

        const storedIncCats = UnifiedStorage.load("app_income_categories_v18");
        if (Array.isArray(storedIncCats) && storedIncCats.length > 0) {
            savedIncomeCategories = storedIncCats;
        } else {
            const legacyCats = UnifiedStorage.load("app_user_categories_v17");
            if (Array.isArray(legacyCats) && legacyCats.length > 0) {
                savedIncomeCategories = legacyCats.filter(c => ["راتب العمل", "مبيعات", "خدمات زبائن", "إيراد إضافي", "أرباح تجارة", "مبيعات زبائن", "سداد ديون"].includes(c));
            }
            if (!savedIncomeCategories || savedIncomeCategories.length === 0) {
                savedIncomeCategories = [...DEFAULT_INCOME_CATEGORIES];
            }
        }

        const storedClients = UnifiedStorage.load("app_saved_clients_v18");
        savedClients = Array.isArray(storedClients) ? storedClients : [];

        const storedWallets = UnifiedStorage.load("app_payment_wallets_v17");
        paymentWallets = (Array.isArray(storedWallets) && storedWallets.length > 0) ? normalizeWalletList(storedWallets) : [...DEFAULT_WALLETS];

        const storedArchived = UnifiedStorage.load("app_archived_clients_v17");
        archivedClients = Array.isArray(storedArchived) ? storedArchived : [];

        customAppTitle = UnifiedStorage.load("app_custom_title_v1") || "";
        appLockPassword = UnifiedStorage.load("app_lock_password_v1") || "";
        deletePassword = UnifiedStorage.load("delete_password_v1") || "";
        updateAppTitleDisplay();
        renderSecuritySettingsUI();
        checkAppLockOnStartup();

        const storedTx = UnifiedStorage.load("app_finances_data_v17");
        allTransactions = Array.isArray(storedTx) ? storedTx : [];
        const storedClientTx = UnifiedStorage.load("app_client_transactions_v1");
        clientTransactions = Array.isArray(storedClientTx) ? storedClientTx : [];
        migrateClientTransactionsIfNeeded();

        const todayStr = formatISODate(new Date());
        document.getElementById("clientSettlementDate").value = todayStr;
        const hsInp = document.getElementById("historyRangeStartInput");
        const heInp = document.getElementById("historyRangeEndInput");
        if (hsInp) hsInp.value = historyRangeStart;
        if (heInp) heInp.value = historyRangeEnd;

        renderDynamicWalletsUI();
        renderCategoriesDatalistAndChips();
        setupPopstateGuard();
        updateClientsDatalist();
        renderMainState();

        initCloudSync();
        UnifiedStorage.loadAllFromIDB(function(idbData) {
            if (!idbData) return;
            let updated = false;
            if (Array.isArray(idbData["app_finances_data_v17"]) && idbData["app_finances_data_v17"].length > 0) {
                if (allTransactions.length === 0 || idbData["app_finances_data_v17"].length > allTransactions.length) {
                    allTransactions = idbData["app_finances_data_v17"];
                    updated = true;
                }
            }
            if (Array.isArray(idbData["app_expense_categories_v18"]) && idbData["app_expense_categories_v18"].length > 0) {
                savedExpenseCategories = idbData["app_expense_categories_v18"];
                updated = true;
            }
            if (Array.isArray(idbData["app_income_categories_v18"]) && idbData["app_income_categories_v18"].length > 0) {
                savedIncomeCategories = idbData["app_income_categories_v18"];
                updated = true;
            }
            if (idbData["app_custom_title_v1"] !== undefined && !customAppTitle) {
                customAppTitle = idbData["app_custom_title_v1"];
                updateAppTitleDisplay();
            renderSecuritySettingsUI();
            checkAppLockOnStartup();
            }
            if (idbData["app_lock_password_v1"] !== undefined && !appLockPassword) {
                appLockPassword = idbData["app_lock_password_v1"] || "";
                renderSecuritySettingsUI();
                checkAppLockOnStartup();
            }
            if (idbData["delete_password_v1"] !== undefined && !deletePassword) {
                deletePassword = idbData["delete_password_v1"] || "";
                renderSecuritySettingsUI();
            }
            if (Array.isArray(idbData["app_saved_clients_v18"])) savedClients = idbData["app_saved_clients_v18"];
            if (Array.isArray(idbData["app_payment_wallets_v17"]) && idbData["app_payment_wallets_v17"].length > 0) {
                paymentWallets = normalizeWalletList(idbData["app_payment_wallets_v17"]);
                updated = true;
            }
            if (Array.isArray(idbData["app_client_transactions_v1"]) && idbData["app_client_transactions_v1"].length > clientTransactions.length) {
                clientTransactions = idbData["app_client_transactions_v1"];
                updated = true;
            }
            if (Array.isArray(idbData["app_archived_clients_v17"])) archivedClients = idbData["app_archived_clients_v17"];
            migrateClientTransactionsIfNeeded();
            if (updated) {
                renderDynamicWalletsUI();
                renderCategoriesDatalistAndChips();
                updateClientsDatalist();
                renderMainState();
            }
        });

        window.addEventListener("pagehide", autoSaveAllState);
        window.addEventListener("beforeunload", autoSaveAllState);
        document.addEventListener("visibilitychange", function() {
            if (document.visibilityState === "hidden") autoSaveAllState();
        });

        document.addEventListener("focusin", function(e) {
            const el = e.target;
            if (el && el.id !== "invClientName") closeClientDropdown();
            if (el && el.id !== "inputTxCategory") closeCategoryDropdown();
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
                if (el.placeholder && el.placeholder !== "") {
                    el.dataset.origPlaceholder = el.placeholder;
                    el.placeholder = "";
                }
                setCaretToEnd(el);
            }
        });
        document.addEventListener("focusout", function(e) {
            const el = e.target;
            if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
                if (!el.value && el.dataset.origPlaceholder) {
                    el.placeholder = el.dataset.origPlaceholder;
                }
            }
        });

        function handleGlobalOutsideClose(e) {
            const menu = document.getElementById("statementActionDropdownMenu");
            const btn = document.getElementById("stmtPlusActionBtn");
            if (menu && menu.classList.contains("is-open")) {
                if (!menu.contains(e.target) && e.target !== btn && (!btn || !btn.contains(e.target))) {
                    menu.classList.remove("is-open");
                }
            }
            const catWrapper = document.getElementById("categoryDropdownWrapper");
            if (catWrapper && !catWrapper.contains(e.target)) closeCategoryDropdown();
            const clientWrapper = document.getElementById("clientDropdownWrapper");
            if (clientWrapper && !clientWrapper.contains(e.target)) closeClientDropdown();
            const cpWrap = document.getElementById("clientsPageSearchWrapper");
            const cpDd = document.getElementById("clientsPageSearchDropdown");
            if (cpDd && cpDd.classList.contains("is-open") && cpWrap && !cpWrap.contains(e.target)) {
                cpDd.classList.remove("is-open");
            }
            if (!e.target.closest(".action-dropdown-wrapper") && !e.target.closest(".action-menu-item")) {
                closeAllActionMenus();
            }
        }

        document.addEventListener("click", handleGlobalOutsideClose);
        window.addEventListener("scroll", function() {
            closeCategoryDropdown();
            closeClientDropdown();
            closeAllActionMenus();
        }, { passive: true });
        document.querySelectorAll(".modal-sheet-scroll-body").forEach(function(sb) {
            sb.addEventListener("scroll", function() {
                closeCategoryDropdown();
                closeClientDropdown();
            }, { passive: true });
        });
    }

    function toggleClientsSubFilter(mode) {
        if (currentMainType !== 'CLIENTS') {
            clientsSubFilter = mode;
            handleTopNavSelect('CLIENTS');
            return;
        }
        clientsSubFilter = (clientsSubFilter === mode) ? 'ALL' : mode;
        renderMainState();
    }

    function openSectionPage(key, openModalOnEnter = false, pushHistory = true) {
        currentMainType = key;
        if (key !== 'CLIENTS') clientsSubFilter = 'ALL';
        if (pushHistory && !isNavigatingViaPopstate) {
            pushAppHistoryStep("section_" + key);
        }

        document.querySelectorAll('.subpage-view-panel').forEach(p => p.classList.add('is-hidden'));
        if (key === "CLIENTS") {
            document.getElementById("clientsFullView").classList.remove("is-hidden");
            syncSidebarActiveItem("sideNavClients");
        } else if (key === "EXPENSE") {
            document.getElementById("expenseFullView").classList.remove("is-hidden");
            syncSidebarActiveItem("sideNavExpense");
        } else if (key === "INCOME") {
            document.getElementById("incomeFullView").classList.remove("is-hidden");
            syncSidebarActiveItem("sideNavIncome");
        }
        renderMainState();
        if (openModalOnEnter) {
            if (key === "EXPENSE") openAddTransactionModal("EXPENSE");
            else if (key === "INCOME") openAddTransactionModal("INCOME");
        }
    }

    function handleTopNavSelect(key) {
        openSectionPage(key, false);
    }

    function handleCenterPlusAction() {
        if (currentMainType === "CLIENTS") openClientInvoiceModal();
        else openAddTransactionModal(currentMainType);
    }

    function toggleStatementActionMenu(e) {
        if (e) e.stopPropagation();
        const menu = document.getElementById("statementActionDropdownMenu");
        if (menu) menu.classList.toggle("is-open");
    }

    function onSelectStatementAction(type) {
        const menu = document.getElementById("statementActionDropdownMenu");
        if (menu) menu.classList.remove("is-open");
        if (type === "invoice") openClientInvoiceModal(activeStatementClient);
        else if (type === "payment") openClientPaymentModal(activeStatementClient);
    }

    let allowAppExit = false;
    let isNavigatingViaPopstate = false;
    let openModalOrderStack = [];

    function pushAppHistoryStep(stepName) {
        if (allowAppExit) return;
        try {
            window.history.pushState({ appStep: stepName || "step", t: Date.now() }, "", "#app");
        } catch(e) {
            try { window.location.hash = "#app"; } catch(e2) {}
        }
    }

    function ensureHashLock() {
        if (allowAppExit) return;
        if (window.location.hash !== "#app" || !window.history.state || !window.history.state.appStep) {
            try {
                window.history.pushState({ appStep: "app_lock", t: Date.now() }, "", "#app");
            } catch(e) {
                try { window.location.hash = "#app"; } catch(e2) {}
            }
        }
    }

    function setupPopstateGuard() {
        try {
            const baseUrl = window.location.href.split("#")[0];
            window.history.replaceState({ page: "root" }, "", baseUrl);
            window.history.pushState({ page: "app_view", appStep: "home", t: Date.now() }, "", "#app");
        } catch(e) {}

        const initTouchGuard = function() { ensureHashLock(); };
        window.addEventListener("touchstart", initTouchGuard, { passive: true, once: true });
        window.addEventListener("pointerdown", initTouchGuard, { passive: true, once: true });
        window.addEventListener("click", initTouchGuard, { once: true });

        let lastBackHandledTime = 0;

        function handleBackNavigation() {
            if (allowAppExit) return;
            const now = Date.now();
            if (now - lastBackHandledTime < 180) return;
            lastBackHandledTime = now;

            isNavigatingViaPopstate = true;
            try {
                // أولاً: إغلاق أي قائمة منسدلة مفتوحة أو القائمة الجانبية للهاتف
                const sb = document.getElementById("appSidebar");
                if (sb && sb.classList.contains("is-mobile-open")) {
                    closeMobileSidebar();
                    return;
                }
                const stmtMenu = document.getElementById("statementActionDropdownMenu");
                if (stmtMenu && stmtMenu.classList.contains("is-open")) {
                    stmtMenu.classList.remove("is-open");
                    return;
                }
                if (document.querySelectorAll(".action-dropdown-menu.is-open").length > 0) {
                    closeAllActionMenus();
                    return;
                }
                const catPanel = document.getElementById("categoryDropdownPanel");
                if (catPanel && catPanel.style.display === "block") {
                    closeCategoryDropdown();
                    return;
                }
                const clientPanel = document.getElementById("clientDropdownPanel");
                if (clientPanel && clientPanel.style.display === "block") {
                    closeClientDropdown();
                    return;
                }
                const cpDd = document.getElementById("clientsPageSearchDropdown");
                if (cpDd && cpDd.classList.contains("is-open")) {
                    cpDd.classList.remove("is-open");
                    return;
                }

                // سابعاً: إذا كانت نافذة تأكيد الخروج مفتوحة أصلاً -> أغلقها وأبقِ المستخدم في البرنامج
                const exitModal = document.getElementById("exitAppConfirmModal");
                if (exitModal && exitModal.classList.contains("is-active-modal")) {
                    closeGlassModal("exitAppConfirmModal");
                    ensureHashLock();
                    return;
                }

                // ثانياً: إغلاق أحدث نافذة منبثقة مفتوحة فقط (باستثناء نافذة تأكيد الخروج)
                const activeModals = Array.from(document.querySelectorAll(".glass-modal-backdrop.is-active-modal"))
                    .filter(m => m.id !== "exitAppConfirmModal");
                if (activeModals.length > 0) {
                    let topModalId = null;
                    while (openModalOrderStack.length > 0) {
                        const cand = openModalOrderStack.pop();
                        const candEl = document.getElementById(cand);
                        if (candEl && candEl.classList.contains("is-active-modal") && cand !== "exitAppConfirmModal") {
                            topModalId = cand;
                            break;
                        }
                    }
                    if (!topModalId) {
                        topModalId = activeModals[activeModals.length - 1].id;
                    }
                    closeGlassModal(topModalId);
                    closeCategoryDropdown();
                    closeClientDropdown();
                    closeAllActionMenus();
                    return;
                }

                // ثالثاً: من كشف حساب زبون -> العودة إلى صفحة الزبائن
                const stmtView = document.getElementById("clientStatementView");
                if (stmtView && !stmtView.classList.contains("is-hidden")) {
                    openSectionPage("CLIENTS", false, false);
                    return;
                }

                // رابعاً: من سجل الحركات -> العودة إلى الصفحة السابقة
                const historyView = document.getElementById("reportsHistoryView");
                if (historyView && !historyView.classList.contains("is-hidden")) {
                    navigateBackFromHistoryView();
                    return;
                }

                // خامساً: من أي صفحة رئيسية فرعية -> العودة إلى الشاشة الرئيسية
                for (const vId of ["clientsFullView", "expenseFullView", "incomeFullView"]) {
                    const vEl = document.getElementById(vId);
                    if (vEl && !vEl.classList.contains("is-hidden")) {
                        navigateToHomeView();
                        return;
                    }
                }

                // سادساً: في الشاشة الرئيسية بدون أي نوافذ مفتوحة -> إظهار تحذير الخروج وإعادة حقن #app
                openGlassModal("exitAppConfirmModal");
                pushAppHistoryStep("exit_confirm");
            } finally {
                isNavigatingViaPopstate = false;
                setTimeout(ensureHashLock, 15);
            }
        }

        window.addEventListener("popstate", handleBackNavigation);
        window.addEventListener("beforeunload", function() {
            if (!allowAppExit) autoSaveAllState();
        });
    }

    function dismissExitPrompt() {
        closeGlassModal('exitAppConfirmModal');
        ensureHashLock();
        displayToast("تم البقاء في البرنامج");
    }

    function confirmExitProgram() {
        allowAppExit = true;
        closeGlassModal('exitAppConfirmModal');
        autoSaveAllState();
        displayToast("تم حفظ بياناتك بنجاح، جاري الخروج...");
        try { window.close(); } catch(e) {}
        setTimeout(function() {
            try { window.history.go(-2); } catch(e) {
                try { window.history.back(); } catch(e2) {}
            }
        }, 150);
    }

    function saveStorage() {
        UnifiedStorage.save("app_finances_data_v17", allTransactions);
        UnifiedStorage.save("app_client_transactions_v1", clientTransactions);
        updateClientsDatalist();
        pushCloudSync();
    }

    function saveWalletsStorage() {
        UnifiedStorage.save("app_payment_wallets_v17", paymentWallets);
        renderDynamicWalletsUI();
        pushCloudSync();
    }

    function saveArchivedStorage() {
        UnifiedStorage.save("app_archived_clients_v17", archivedClients);
        pushCloudSync();
    }

    function saveExpenseCategoriesStorage() {
        UnifiedStorage.save("app_expense_categories_v18", savedExpenseCategories);
        renderCategoriesDatalistAndChips();
        pushCloudSync();
    }

    function saveIncomeCategoriesStorage() {
        UnifiedStorage.save("app_income_categories_v18", savedIncomeCategories);
        renderCategoriesDatalistAndChips();
        pushCloudSync();
    }

    function saveClientsStorage() {
        UnifiedStorage.save("app_saved_clients_v18", savedClients);
        populateClientDropdown(getAllClients());
        pushCloudSync();
    }

    let historyTimeScope = 'ALL';
    let historyRangeStart = formatISODate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    let historyRangeEnd = formatISODate(new Date());

    function setHistoryTimeScope(scope) {
        historyTimeScope = scope === 'TODAY' ? 'TODAY' : 'ALL';
        const btnAll = document.getElementById("btnHistoryScopeAll");
        const btnToday = document.getElementById("btnHistoryScopeToday");
        const rangeBar = document.getElementById("historyCustomRangeBar");
        if (btnAll) btnAll.classList.toggle("is-active", historyTimeScope === 'ALL');
        if (btnToday) btnToday.classList.toggle("is-active", historyTimeScope === 'TODAY');
        if (rangeBar) rangeBar.classList.toggle("is-visible", historyTimeScope === 'TODAY');

        if (historyTimeScope === 'TODAY') {
            const sInp = document.getElementById("historyRangeStartInput");
            const eInp = document.getElementById("historyRangeEndInput");
            if (sInp && !sInp.value) sInp.value = historyRangeStart;
            if (eInp && !eInp.value) eInp.value = historyRangeEnd;
            if (sInp && sInp.value) historyRangeStart = sInp.value;
            if (eInp && eInp.value) historyRangeEnd = eInp.value;
        }
        renderMainState();
    }

    function onHistoryRangeChanged() {
        const sInp = document.getElementById("historyRangeStartInput");
        const eInp = document.getElementById("historyRangeEndInput");
        historyRangeStart = sInp ? sInp.value : "";
        historyRangeEnd = eInp ? eInp.value : "";
        historyTimeScope = 'TODAY';
        const btnAll = document.getElementById("btnHistoryScopeAll");
        const btnToday = document.getElementById("btnHistoryScopeToday");
        const rangeBar = document.getElementById("historyCustomRangeBar");
        if (btnAll) btnAll.classList.remove("is-active");
        if (btnToday) btnToday.classList.add("is-active");
        if (rangeBar) rangeBar.classList.add("is-visible");
        renderMainState();
    }

    function formatCurrentTime12h(dateObj = new Date()) {
        let h = dateObj.getHours();
        const m = String(dateObj.getMinutes()).padStart(2, "0");
        const suffix = h >= 12 ? "م" : "ص";
        h = h % 12;
        if (h === 0) h = 12;
        return `${String(h).padStart(2, "0")}:${m} ${suffix}`;
    }

    function formatDateWithTime(tx) {
        const d = (tx && tx.date) ? String(tx.date).replace(/-/g, '/') : '';
        const t = (tx && tx.time) ? String(tx.time).trim() : '';
        return t ? `${d} • ${t}` : d;
    }

    function formatTimeBeforeDate(tx) {
        const d = (tx && tx.date) ? String(tx.date).replace(/-/g, '/') : '';
        const t = (tx && tx.time) ? String(tx.time).trim() : '';
        return t ? `${t} • ${d}` : d;
    }

    function formatISODate(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
    }

    function formatNumericDateSlash(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}/${m}/${day}`;
    }

    let toastTimer = null;
    function displayToast(msg, isErr = false) {
        const toast = document.getElementById("neonToastPopup");
        const icon = document.getElementById("toastIconSlot");
        const text = document.getElementById("toastTextSlot");
        if (toastTimer) clearTimeout(toastTimer);
        toast.className = "toast-neon-box show-active";
        icon.innerText = isErr ? "✕" : "✓";
        icon.style.color = isErr ? "var(--neon-red)" : "var(--neon-green)";
        text.innerText = msg;
        toastTimer = setTimeout(() => toast.classList.remove("show-active"), 2600);
    }

    let historyReportTypeFilter = 'ALL';
    let activeDetailCategory = null;
    let activeDetailType = 'EXPENSE';

    function getCardSquircleIconHtml(typeKey) {
        if (typeKey === "is-expense") {
            return '<span class="apple-card-squircle is-expense"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg></span>';
        }
        if (typeKey === "is-income" || typeKey === "is-payment") {
            return `<span class="apple-card-squircle ${typeKey}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg></span>`;
        }
        return '<span class="apple-card-squircle is-invoice"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>';
    }

    function getWalletIconEmoji(walletName) {
        const w = String(walletName || "");
        if (w.includes("كاش")) {
            return '<span class="apple-inline-wallet-ico"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="6" width="20" height="12" rx="3"/><circle cx="12" cy="12" r="2.5"/></svg></span>';
        }
        if (w.includes("بنك") && !w.includes("محفظة")) {
            return '<span class="apple-inline-wallet-ico"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M3 10h18"/><path d="M5 6l7-3 7 3"/><path d="M4 10v11"/><path d="M20 10v11"/><path d="M8 14v3"/><path d="M12 14v3"/><path d="M16 14v3"/></svg></span>';
        }
        if (w.includes("محفظة") || w.includes("جوال") || w.includes("باي")) {
            return '<span class="apple-inline-wallet-ico"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="2" width="12" height="20" rx="3"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg></span>';
        }
        return '<span class="apple-inline-wallet-ico"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/></svg></span>';
    }

    function toggleHistoryReportTypeFilter(typeKey) {
        if (typeKey === 'ALL') {
            historyReportTypeFilter = 'ALL';
        } else {
            historyReportTypeFilter = (historyReportTypeFilter === typeKey) ? 'ALL' : typeKey;
        }
        renderMainState();
    }

    function openCategoryDetailModal(cat, type) {
        activeDetailCategory = cat;
        activeDetailType = type || 'EXPENSE';
        renderCategoryDetailModalContent();
        openGlassModal('categoryDetailModal');
    }

    function renderCategoryDetailModalContent() {
        if (!activeDetailCategory) return;
        const isInc = activeDetailType === 'INCOME';
        const titleEl = document.getElementById('categoryDetailModalTitle');
        const summaryBar = document.getElementById('categoryDetailSummaryBar');
        const modalSheet = document.querySelector('#categoryDetailModal .glass-modal-sheet');
        const countEl = document.getElementById('categoryDetailCountVal');
        const totalEl = document.getElementById('categoryDetailTotalVal');
        const listEl = document.getElementById('categoryDetailTxList');

        if (titleEl) {
            titleEl.innerText = `${isInc ? 'تفاصيل دخل' : 'تفاصيل مصروف'}: ${activeDetailCategory}`;
            titleEl.style.color = isInc ? 'var(--neon-green)' : 'var(--neon-red)';
        }
        if (modalSheet) {
            modalSheet.style.borderTopColor = isInc ? '#10B981' : '#EF4444';
        }
        if (summaryBar) {
            summaryBar.classList.toggle('is-income', isInc);
            summaryBar.classList.toggle('is-expense', !isInc);
        }

        const timeRange = getTimeFilterRange();
        const directItems = allTransactions.filter(t =>
            t.type === activeDetailType &&
            (t.category || 'أخرى') === activeDetailCategory &&
            checkItemInFilterRange(t, timeRange)
        );
        const clientReceiptItems = activeDetailType === 'INCOME'
            ? clientTransactions
                .filter(t => Number(t.amount || 0) > 0 && checkItemInFilterRange(t, timeRange))
                .map(t => ({
                    ...t,
                    type: 'INCOME',
                    category: t.isPayment ? 'سداد ديون' : 'مقبوضات زبائن',
                    note: t.client ? `${t.client}${t.note ? ' • ' + t.note : ''}` : (t.note || '')
                }))
                .filter(t => t.category === activeDetailCategory)
            : [];
        const items = [...directItems, ...clientReceiptItems].sort((a, b) => new Date(b.date) - new Date(a.date) || (Number(b.id) - Number(a.id)));
        const totalAmt = items.reduce((s, t) => s + Number(t.amount || 0), 0);

        if (countEl) countEl.innerText = `${items.length} حركة`;
        if (totalEl) totalEl.innerText = totalAmt.toLocaleString('en-US', { maximumFractionDigits: 2 });

        if (!listEl) return;
        listEl.innerHTML = '';
        if (items.length === 0) {
            listEl.innerHTML = '<div class="empty-records-message">لا توجد حركات مسجلة لهذا الصنف في هذه الفترة</div>';
            return;
        }

        items.forEach(tx => {
            const row = document.createElement('div');
            const stateCls = isInc ? 'is-income' : 'is-expense';
            row.className = `unified-tx-card ${stateCls}`;
            const noteTxt = tx.note ? escapeHTML(tx.note) : escapeHTML(tx.category || '');
            row.innerHTML = `
                <div class="unified-tx-card-main">
                    <div class="unified-tx-right">
                        <div class="unified-tx-row1">
                            <span class="unified-tx-title">${noteTxt}</span>
                        </div>
                        <div class="unified-tx-row2">
                            <span class="record-wallet-badge">${getWalletIconEmoji(tx.wallet)}${escapeHTML(normalizeWalletName(tx.wallet))}</span>
                        </div>
                        <div class="unified-tx-row3">${formatDateWithTime(tx)}</div>
                    </div>
                </div>
                <div class="unified-tx-left-wrap">
                    <div class="unified-tx-left-top-actions">
                        ${getCardSquircleIconHtml(stateCls)}
                        <div class="action-dropdown-wrapper">
                            <button type="button" class="three-dots-btn" data-id="${tx.id}" onclick="toggleActionMenu(event, this.getAttribute('data-id'))" title="خيارات التعديل والحذف">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                    <circle cx="12" cy="5" r="2.2"/>
                                    <circle cx="12" cy="12" r="2.2"/>
                                    <circle cx="12" cy="19" r="2.2"/>
                                </svg>
                            </button>
                            <div class="action-dropdown-menu" id="actionMenu_detail_${tx.id}">
                                <button type="button" class="action-menu-item edit-item" data-id="${tx.id}" onclick="onActionMenuEdit(this.getAttribute('data-id'))">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                    <span>تعديل</span>
                                </button>
                                <button type="button" class="action-menu-item del-item" data-id="${tx.id}" onclick="onActionMenuDelete(this.getAttribute('data-id'))">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                    <span>حذف</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="unified-tx-left-bottom-amt">
                        <div class="unified-tx-paid ${isInc ? 'green' : 'red'}">
                            ${isInc ? '+' : '-'}${Number(tx.amount || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>
            `;
            listEl.appendChild(row);
        });
    }

    function navigateToHomeView() {
        document.querySelectorAll('.subpage-view-panel').forEach(p => p.classList.add('is-hidden'));
        document.getElementById('homeMainView').classList.remove('is-hidden');
        if (currentMainType === "EXPENSE") syncSidebarActiveItem("sideNavExpense");
        else if (currentMainType === "INCOME") syncSidebarActiveItem("sideNavIncome");
        else if (currentMainType === "CLIENTS") syncSidebarActiveItem("sideNavClients");
        renderMainState();
    }

    let previousPage = 'home';

    function navigateToHistoryViewWithCategory(cat = null) {
        const expEl = document.getElementById('expenseFullView');
        const incEl = document.getElementById('incomeFullView');
        const cliEl = document.getElementById('clientsFullView');
        const histEl = document.getElementById('reportsHistoryView');

        if (expEl && !expEl.classList.contains('is-hidden')) previousPage = 'expenses';
        else if (incEl && !incEl.classList.contains('is-hidden')) previousPage = 'income';
        else if (cliEl && !cliEl.classList.contains('is-hidden')) previousPage = 'clients';
        else if (!histEl || histEl.classList.contains('is-hidden')) previousPage = 'home';

        if (!isNavigatingViaPopstate) {
            pushAppHistoryStep("history");
        }
        selectedHistoryCategory = cat;
        document.querySelectorAll('.subpage-view-panel').forEach(p => p.classList.add('is-hidden'));
        document.getElementById('reportsHistoryView').classList.remove('is-hidden');
        syncSidebarActiveItem("sideNavHistory");
        renderMainState();
    }

    function navigateBackFromHistoryView() {
        selectedHistoryCategory = null;
        if (previousPage === 'expenses') openSectionPage('EXPENSE', false, false);
        else if (previousPage === 'income') openSectionPage('INCOME', false, false);
        else if (previousPage === 'clients') openSectionPage('CLIENTS', false, false);
        else navigateToHomeView();
    }

    function navigateToClientStatement(clientName) {
        activeStatementClient = clientName;
        if (!isNavigatingViaPopstate) {
            pushAppHistoryStep("client_statement");
        }
        document.querySelectorAll('.subpage-view-panel').forEach(p => p.classList.add('is-hidden'));
        document.getElementById('clientStatementView').classList.remove('is-hidden');
        syncSidebarActiveItem("sideNavClients");
        renderClientStatement();
    }

    function isCategoryUsedInTransactions(catName) {
        return allTransactions.some(t => t.category === catName);
    }

    function getActiveCategoriesList() {
        return modalActiveTxType === "INCOME" ? savedIncomeCategories : savedExpenseCategories;
    }

    function registerNewCategoryIfMissing(cat, type = null) {
        const cleanCat = (cat || "").trim();
        if (!cleanCat) return;
        const targetType = type || modalActiveTxType;
        if (targetType === "INCOME") {
            if (!savedIncomeCategories.includes(cleanCat)) {
                savedIncomeCategories.unshift(cleanCat);
                saveIncomeCategoriesStorage();
            }
        } else {
            if (!savedExpenseCategories.includes(cleanCat)) {
                savedExpenseCategories.unshift(cleanCat);
                saveExpenseCategoriesStorage();
            }
        }
    }

    function renderCategoriesDatalistAndChips() {
        populateCategoryDropdown(getActiveCategoriesList());
        renderSettingsCategoriesUI();
    }

    function renderSettingsCategoriesUI() {
        const expContainer = document.getElementById("settingsExpenseCategoriesTagsContainer");
        if (expContainer) {
            expContainer.innerHTML = savedExpenseCategories.map(c => `
                <div class="wallet-tag-item">
                    <span>${escapeHTML(c)}</span>
                    <button type="button" class="wallet-tag-del-btn" data-cat="${escapeHTML(c)}" onclick="removeSavedExpenseCategory(this.getAttribute('data-cat'))" title="حذف التصنيف إذا كان فارغاً">✕</button>
                </div>
            `).join("");
        }

        const incContainer = document.getElementById("settingsIncomeCategoriesTagsContainer");
        if (incContainer) {
            incContainer.innerHTML = savedIncomeCategories.map(c => `
                <div class="wallet-tag-item">
                    <span>${escapeHTML(c)}</span>
                    <button type="button" class="wallet-tag-del-btn" data-cat="${escapeHTML(c)}" onclick="removeSavedIncomeCategory(this.getAttribute('data-cat'))" title="حذف التصنيف إذا كان فارغاً">✕</button>
                </div>
            `).join("");
        }
    }

    function addNewExpenseCategory() {
        const inp = document.getElementById("newExpenseCatInput");
        const val = (inp.value || "").trim();
        if (!val) { displayToast("يرجى كتابة اسم تصنيف المصروف", true); return; }
        if (savedExpenseCategories.includes(val)) { displayToast("تصنيف المصروف موجود مسبقاً", true); return; }
        savedExpenseCategories.unshift(val);
        saveExpenseCategoriesStorage();
        inp.value = "";
        displayToast(`تمت إضافة تصنيف المصروف "${val}"`);
    }

    function addNewIncomeCategory() {
        const inp = document.getElementById("newIncomeCatInput");
        const val = (inp.value || "").trim();
        if (!val) { displayToast("يرجى كتابة اسم تصنيف الدخل", true); return; }
        if (savedIncomeCategories.includes(val)) { displayToast("تصنيف الدخل موجود مسبقاً", true); return; }
        savedIncomeCategories.unshift(val);
        saveIncomeCategoriesStorage();
        inp.value = "";
        displayToast(`تمت إضافة تصنيف الدخل "${val}"`);
    }

    function populateCategoryDropdown(cats) {
        const list = document.getElementById("categoryDropdownList");
        if (!list) return;
        list.innerHTML = "";
        if (!cats || cats.length === 0) {
            list.innerHTML = '<div class="custom-dropdown-item is-empty-hint">لا توجد تصنيفات مطابقة (سيتم حفظ الجديد تلقائياً)</div>';
            return;
        }
        cats.forEach(c => {
            const item = document.createElement("div");
            item.className = "custom-dropdown-item";

            const nameSpan = document.createElement("span");
            nameSpan.className = "custom-dropdown-cat-name";
            nameSpan.textContent = c;
            nameSpan.onclick = function() { selectCategoryFromDropdown(c); };

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "custom-dropdown-del-btn";
            delBtn.textContent = "✕";
            delBtn.title = "حذف هذا الصنف إذا كان فارغاً";
            delBtn.onclick = function(e) {
                e.stopPropagation();
                if (modalActiveTxType === "INCOME") removeSavedIncomeCategory(c);
                else removeSavedExpenseCategory(c);
            };

            item.appendChild(nameSpan);
            item.appendChild(delBtn);
            list.appendChild(item);
        });
    }

    function openCategoryDropdown(populateAll = false) {
        const panel = document.getElementById("categoryDropdownPanel");
        const wrapper = document.getElementById("categoryDropdownWrapper");
        if (!panel) return;
        const activeCats = getActiveCategoriesList();
        const currentVal = (populateAll ? "" : (document.getElementById("inputTxCategory")?.value || "")).trim().toLowerCase();
        if (currentVal) handleCategoryInputTyping(currentVal);
        else populateCategoryDropdown(activeCats);
        panel.style.display = "block";
        if (wrapper) wrapper.classList.add("is-open");
    }

    function closeCategoryDropdown() {
        const panel = document.getElementById("categoryDropdownPanel");
        const wrapper = document.getElementById("categoryDropdownWrapper");
        if (panel) panel.style.display = "none";
        if (wrapper) wrapper.classList.remove("is-open");
    }

    function toggleCategoryDropdown(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const panel = document.getElementById("categoryDropdownPanel");
        if (panel && panel.style.display === "block") {
            closeCategoryDropdown();
        } else {
            openCategoryDropdown(true);
            const inp = document.getElementById("inputTxCategory");
            if (inp) inp.focus();
        }
    }

    function handleCategoryInputTyping(query) {
        const cleanQuery = (query || "").trim().toLowerCase();
        const panel = document.getElementById("categoryDropdownPanel");
        const wrapper = document.getElementById("categoryDropdownWrapper");
        if (panel) panel.style.display = "block";
        if (wrapper) wrapper.classList.add("is-open");

        const activeCats = getActiveCategoriesList();
        if (!cleanQuery) { populateCategoryDropdown(activeCats); return; }
        populateCategoryDropdown(activeCats.filter(c => c.toLowerCase().includes(cleanQuery)));
    }

    function selectCategoryFromDropdown(catName) {
        const inp = document.getElementById("inputTxCategory");
        if (inp) inp.value = catName;
        closeCategoryDropdown();
    }

    function removeSavedExpenseCategory(c) {
        if (isCategoryUsedInTransactions(c)) {
            displayToast(`لا يمكن حذف التصنيف "${c}" لأنه مستخدم في حركات مالية مسجلة!`, true);
            return;
        }
        if (savedExpenseCategories.length <= 1) {
            displayToast("يجب الإبقاء على تصنيف مصروف واحد على الأقل", true);
            return;
        }
        const doDel = () => {
            savedExpenseCategories = savedExpenseCategories.filter(item => item !== c);
            const catInp = document.getElementById("inputTxCategory");
            if (catInp && catInp.value === c && modalActiveTxType === "EXPENSE") catInp.value = "";
            saveExpenseCategoriesStorage();
            displayToast(`تم حذف تصنيف المصروف الفارغ "${c}"`);
        };
        promptConfirmDialog("حذف تصنيف مصروف", `هل أنت متأكد من حذف التصنيف "${c}"؟`, doDel, true, "تأكيد الحذف");
    }

    function removeSavedIncomeCategory(c) {
        if (isCategoryUsedInTransactions(c)) {
            displayToast(`لا يمكن حذف التصنيف "${c}" لأنه مستخدم في حركات مالية مسجلة!`, true);
            return;
        }
        if (savedIncomeCategories.length <= 1) {
            displayToast("يجب الإبقاء على تصنيف دخل واحد على الأقل", true);
            return;
        }
        const doDel = () => {
            savedIncomeCategories = savedIncomeCategories.filter(item => item !== c);
            const catInp = document.getElementById("inputTxCategory");
            if (catInp && catInp.value === c && modalActiveTxType === "INCOME") catInp.value = "";
            saveIncomeCategoriesStorage();
            displayToast(`تم حذف تصنيف الدخل الفارغ "${c}"`);
        };
        promptConfirmDialog("حذف تصنيف دخل", `هل أنت متأكد من حذف التصنيف "${c}"؟`, doDel, true, "تأكيد الحذف");
    }

    function renderDynamicWalletsUI() {
        const bar = document.getElementById("historyWalletsDynamicBar");
        if (bar) {
            let html = `<button class="glass-wallet-chip ${selectedHistoryWallet === 'ALL' ? 'is-active' : ''}" data-w="ALL" onclick="selectHistoryWalletFilter('ALL', this)">الكل</button>`;
            paymentWallets.forEach(w => {
                const activeCls = selectedHistoryWallet === w ? 'is-active' : '';
                html += `<button class="glass-wallet-chip ${activeCls}" data-w="${escapeHTML(w)}" onclick="selectHistoryWalletFilter(this.getAttribute('data-w'), this)">${escapeHTML(w)}</button>`;
            });
            bar.innerHTML = html;
        }

        const modalWalletSelect = document.getElementById("modalTxWalletSelect");
        if (modalWalletSelect) {
            modalWalletSelect.innerHTML = paymentWallets.map(w => `<option value="${escapeHTML(w)}">${escapeHTML(w)}</option>`).join("");
            if (paymentWallets.includes(modalSelectedWallet)) modalWalletSelect.value = modalSelectedWallet;
        }

        const invSelect = document.getElementById("clientInvoiceMethod");
        const paySelect = document.getElementById("clientSettlementMethod");
        const optionsHtml = paymentWallets.map(w => `<option value="${escapeHTML(w)}">${escapeHTML(w)}</option>`).join("");
        if (invSelect) invSelect.innerHTML = optionsHtml;
        if (paySelect) paySelect.innerHTML = optionsHtml;

        const tagsContainer = document.getElementById("settingsWalletsTagsContainer");
        if (tagsContainer) {
            tagsContainer.innerHTML = paymentWallets.map(w => `
                <div class="wallet-tag-item">
                    <span>${escapeHTML(w)}</span>
                    <button type="button" class="wallet-tag-del-btn" data-w="${escapeHTML(w)}" onclick="removePaymentWallet(this.getAttribute('data-w'))" title="حذف وسيلة الدفع">✕</button>
                </div>
            `).join("");
        }
    }

    function updateModalWalletBalancePreview() {
        const sel = document.getElementById("modalTxWalletSelect");
        const wallet = sel ? sel.value : modalSelectedWallet;
        const badge = document.getElementById("modalWalletBalIndicator");
        if (!badge) return;
        const bal = getWalletBalance(wallet, editingRecordId);
        if (bal < 0) {
            badge.style.color = "var(--neon-red)";
            badge.innerText = `(عجز حالي: ${bal.toLocaleString("en-US", {maximumFractionDigits: 2})})`;
        } else if (modalActiveTxType === "EXPENSE") {
            if (bal === 0 && normalizeWalletName(wallet) === "كاش") {
                badge.style.color = "var(--neon-amber)";
                badge.innerText = "(رصيد 0.00 • متاح بالدَّين)";
            } else if (bal <= 0) {
                badge.style.color = "var(--neon-red)";
                badge.innerText = "(رصيد فارغ: 0.00)";
            } else {
                badge.style.color = "var(--neon-green)";
                badge.innerText = `(المتوفر: ${bal.toLocaleString("en-US", {maximumFractionDigits: 2})})`;
            }
        } else {
            badge.style.color = "var(--text-muted)";
            badge.innerText = `(الحالي: ${bal.toLocaleString("en-US", {maximumFractionDigits: 2})})`;
        }
    }

    function addNewPaymentWallet() {
        const inp = document.getElementById("newWalletInputName");
        const val = (inp.value || "").trim();
        if (!val) { displayToast("يرجى كتابة اسم وسيلة الدفع", true); return; }
        if (paymentWallets.includes(val)) { displayToast("وسيلة الدفع موجودة مسبقاً", true); return; }
        paymentWallets.push(val);
        saveWalletsStorage();
        inp.value = "";
        displayToast(`تمت إضافة ${val} كوسيلة دفع`);
    }

    function removePaymentWallet(w) {
        if (paymentWallets.length <= 1) { displayToast("يجب الإبقاء على وسيلة دفع واحدة على الأقل", true); return; }
        promptConfirmDialog("حذف وسيلة دفع", `هل تريد حذف وسيلة "${w}" من قائمة الدفع؟`, () => {
            paymentWallets = paymentWallets.filter(item => item !== w);
            if (modalSelectedWallet === w && paymentWallets.length > 0) modalSelectedWallet = paymentWallets[0];
            if (selectedHistoryWallet === w) selectedHistoryWallet = "ALL";
            saveWalletsStorage();
            displayToast(`تم حذف وسيلة "${w}"`);
            renderMainState();
        });
    }

    function selectTimePeriod(key, btn) {
        activePeriodKey = key;
        if (key === "day") activeRefDate = new Date();
        const dayBtn = document.getElementById("btnHomeDayReset");
        if (dayBtn) dayBtn.classList.toggle("is-active", key === "day");
        renderMainState();
    }

    function openHomeDatePickerModal() {
        const singleInp = document.getElementById("homeSingleDateInput");
        const startInp = document.getElementById("homeRangeStartInput");
        const endInp = document.getElementById("homeRangeEndInput");
        if (singleInp) singleInp.value = formatISODate(activeRefDate);
        if (startInp) startInp.value = customPickedStartDate;
        if (endInp) endInp.value = customPickedEndDate || formatISODate(new Date());
        openGlassModal("homeDatePickerModal");
    }

    function applyHomeSingleDate() {
        const val = document.getElementById("homeSingleDateInput")?.value;
        if (!val) return;
        const [y, m, d] = val.split("-").map(Number);
        activeRefDate = new Date(y, m - 1, d);
        activePeriodKey = "day";
        const dayBtn = document.getElementById("btnHomeDayReset");
        if (dayBtn) dayBtn.classList.toggle("is-active", formatISODate(activeRefDate) === formatISODate(new Date()));
        closeGlassModal("homeDatePickerModal");
        renderMainState();
    }

    function applyHomeCustomRange() {
        const sVal = document.getElementById("homeRangeStartInput")?.value;
        const eVal = document.getElementById("homeRangeEndInput")?.value;
        if (!sVal || !eVal) return;
        customPickedStartDate = sVal;
        customPickedEndDate = eVal;
        activePeriodKey = "custom";
        const dayBtn = document.getElementById("btnHomeDayReset");
        if (dayBtn) dayBtn.classList.remove("is-active");
        closeGlassModal("homeDatePickerModal");
        renderMainState();
    }

    function triggerDatePick() {
        const triggerInput = document.getElementById("customStartDateInput");
        if (!triggerInput) return;
        triggerInput.value = activePeriodKey === "custom" ? customPickedStartDate : formatISODate(activeRefDate);
        try { triggerInput.showPicker(); } catch(e) { triggerInput.click(); }
    }

    function onCustomStartDatePicked(val) {
        if (!val) return;
        if (activePeriodKey === "custom") {
            customPickedStartDate = val;
        } else {
            const [y, m, d] = val.split("-").map(Number);
            activeRefDate = new Date(y, m - 1, d);
        }
        renderMainState();
    }

    function offsetActiveDate(step) {
        if (activePeriodKey === "day") activeRefDate.setDate(activeRefDate.getDate() + step);
        else if (activePeriodKey === "week") activeRefDate.setDate(activeRefDate.getDate() + (step * 7));
        else if (activePeriodKey === "month") activeRefDate.setMonth(activeRefDate.getMonth() + step);
        else if (activePeriodKey === "custom") {
            const [y, m, d] = customPickedStartDate.split("-").map(Number);
            const dt = new Date(y, m - 1, d);
            dt.setDate(dt.getDate() + step);
            customPickedStartDate = formatISODate(dt);
            const customInp = document.getElementById("customStartDateInput");
            if (customInp) customInp.value = customPickedStartDate;
        }
        const dayBtn = document.getElementById("btnHomeDayReset");
        if (dayBtn) dayBtn.classList.toggle("is-active", activePeriodKey === "day" && formatISODate(activeRefDate) === formatISODate(new Date()));
        renderMainState();
    }

    function selectHistoryWalletFilter(w, btn) {
        selectedHistoryWallet = w;
        document.querySelectorAll(".glass-wallet-chip").forEach(b => b.classList.remove("is-active"));
        if (btn) btn.classList.add("is-active");
        renderMainState();
    }

    function clearCategoryFilter() {
        selectedHistoryCategory = null;
        renderMainState();
    }

    function getTimeFilterRange() {
        const todayStr = formatISODate(new Date());
        if (activePeriodKey === "custom") return { type: "range", start: customPickedStartDate, end: customPickedEndDate || todayStr };
        const ty = activeRefDate.getFullYear();
        const tm = activeRefDate.getMonth();
        const td = activeRefDate.getDate();

        if (activePeriodKey === "day") return { type: "exact", date: formatISODate(activeRefDate) };
        if (activePeriodKey === "month") return { type: "prefix", prefix: `${ty}-${String(tm + 1).padStart(2, "0")}` };
        if (activePeriodKey === "week") {
            const dObj = new Date(ty, tm, td);
            const dayOfWeek = dObj.getDay();
            const firstDate = new Date(ty, tm, td - dayOfWeek);
            const lastDate = new Date(ty, tm, td - dayOfWeek + 6);
            return { type: "range", start: formatISODate(firstDate), end: formatISODate(lastDate) };
        }
        return { type: "all" };
    }

    function checkItemInFilterRange(t, range) {
        if (!t || !t.date) return false;
        if (range.type === "exact") return t.date === range.date;
        if (range.type === "prefix") return t.date.startsWith(range.prefix);
        if (range.type === "range") return t.date >= range.start && t.date <= range.end;
        return true;
    }

    function matchesTimeFilter(t) {
        return checkItemInFilterRange(t, getTimeFilterRange());
    }

    function computeAllClientLedgers() {
        const map = {};
        for (let i = 0; i < clientTransactions.length; i++) {
            const t = clientTransactions[i];
            if (!t.client) continue;
            let rec = map[t.client];
            if (!rec) {
                rec = { req: 0, paid: 0, debt: 0, count: 0 };
                map[t.client] = rec;
            }
            rec.count++;
            const amt = Number(t.amount) || 0;
            if (t.isPayment) {
                rec.paid += amt;
            } else {
                const reqAmt = t.reqAmount !== undefined ? Number(t.reqAmount) : amt;
                rec.req += reqAmt;
                rec.paid += amt;
            }
        }
        for (const client in map) {
            map[client].debt = Math.max(0, map[client].req - map[client].paid);
            map[client].credit = Math.max(0, map[client].paid - map[client].req);
        }
        return map;
    }

    function computeClientLedger(clientName) {
        let req = 0, paid = 0;
        for (let i = 0; i < clientTransactions.length; i++) {
            const t = clientTransactions[i];
            if (t.client !== clientName) continue;
            const amt = Number(t.amount) || 0;
            if (t.isPayment) paid += amt;
            else {
                req += t.reqAmount !== undefined ? Number(t.reqAmount) : amt;
                paid += amt;
            }
        }
        return { req, paid, debt: Math.max(0, req - paid), credit: Math.max(0, paid - req) };
    }

    function computeAllMarketDebts(precomputedLedgers = null) {
        const ledgers = precomputedLedgers || computeAllClientLedgers();
        let totalDebt = 0;
        for (const c in ledgers) {
            if (!archivedClients.includes(c)) totalDebt += ledgers[c].debt;
        }
        return totalDebt;
    }

    function renderMainState() {
        updateDateLabelDisplay();

        const timeRange = getTimeFilterRange();
        const clientLedgers = computeAllClientLedgers();
        const totalMarketDebts = computeAllMarketDebts(clientLedgers);

        let histIncome = 0, histExpense = 0, totalAllIncome = 0, totalAllExpense = 0;
        const periodItems = [];
        const historyScopeItems = [];
        const startHistD = historyRangeStart || "0000-01-01";
        const endHistD = historyRangeEnd || "9999-12-31";

        let allWalletsPeriodIncome = 0, allWalletsPeriodExpense = 0, directPeriodIncome = 0, clientInvoicesPeriodTotal = 0, todayNewDebts = 0;

        for (let i = 0; i < allTransactions.length; i++) {
            const t = allTransactions[i];
            const amt = Number(t.amount) || 0;
            if (t.type === "INCOME") totalAllIncome += amt;
            else if (t.type === "EXPENSE") totalAllExpense += amt;

            if (checkItemInFilterRange(t, timeRange)) {
                periodItems.push(t);
                if (t.type === "INCOME") { allWalletsPeriodIncome += amt; directPeriodIncome += amt; }
                else if (t.type === "EXPENSE") allWalletsPeriodExpense += amt;
            }

            const inHistoryScope = (historyTimeScope === 'ALL') || (t.date >= startHistD && t.date <= endHistD);
            if (inHistoryScope) {
                historyScopeItems.push(t);
                if (selectedHistoryWallet === "ALL" || normalizeWalletName(t.wallet) === normalizeWalletName(selectedHistoryWallet)) {
                    if (t.type === "INCOME") histIncome += amt;
                    else if (t.type === "EXPENSE") histExpense += amt;
                }
            }
        }

        for (let i = 0; i < clientTransactions.length; i++) {
            const t = clientTransactions[i];
            const amt = Number(t.amount) || 0;
            if (checkItemInFilterRange(t, timeRange) && !t.isPayment) {
                const reqAmt = t.reqAmount !== undefined ? Number(t.reqAmount) : amt;
                clientInvoicesPeriodTotal += reqAmt;
                todayNewDebts += Math.max(0, reqAmt - amt);
            }
            if (amt <= 0) continue;
            totalAllIncome += amt;

            const normalizedReceipt = {
                ...t,
                type: "INCOME",
                category: t.isPayment ? "سداد ديون" : "مقبوضات زبائن",
                isClientReceipt: true
            };

            if (checkItemInFilterRange(t, timeRange)) {
                periodItems.push(normalizedReceipt);
                allWalletsPeriodIncome += amt;
            }

            const inHistoryScope = (historyTimeScope === 'ALL') || (t.date >= startHistD && t.date <= endHistD);
            if (inHistoryScope) {
                historyScopeItems.push(normalizedReceipt);
                if (selectedHistoryWallet === "ALL" || normalizeWalletName(t.wallet) === normalizeWalletName(selectedHistoryWallet)) {
                    histIncome += amt;
                }
            }
        }

        periodItems.sort((a, b) => new Date(b.date) - new Date(a.date) || (Number(b.id) - Number(a.id)));
        historyScopeItems.sort((a, b) => new Date(b.date) - new Date(a.date) || (Number(b.id) - Number(a.id)));

        const netHist = histIncome - histExpense;
        const totalNetAll = totalAllIncome - totalAllExpense;

        document.getElementById("kpiFixedIncomeTopNumber").innerText = histIncome.toLocaleString("en-US", { maximumFractionDigits: 2 });
        document.getElementById("kpiExpenseNumber").innerText = histExpense.toLocaleString("en-US", { maximumFractionDigits: 2 });
        document.getElementById("netBalanceNumber").innerText = netHist.toLocaleString("en-US", { maximumFractionDigits: 2 });
        let totalClientCredits = 0;
        for (const c in clientLedgers) {
            if (!archivedClients.includes(c)) totalClientCredits += (clientLedgers[c].credit || 0);
        }

        const homeDebtPeriodWord = (activePeriodKey === "day") ? "اليوم" : "الفترة";
        document.getElementById("homeTotalDebtsBanner").innerText = `${todayNewDebts.toLocaleString("en-US", { maximumFractionDigits: 2 })} دين ${homeDebtPeriodWord}`;
        const expBannerEl = document.getElementById("homeTotalExpenseBanner");
        if (expBannerEl) expBannerEl.innerText = allWalletsPeriodExpense.toLocaleString("en-US", { maximumFractionDigits: 2 });
        const incBannerEl = document.getElementById("homeTotalIncomeBanner");
        if (incBannerEl) incBannerEl.innerText = allWalletsPeriodIncome.toLocaleString("en-US", { maximumFractionDigits: 2 });
        const eqSales = allWalletsPeriodIncome + todayNewDebts;
        const eqNet = allWalletsPeriodIncome - allWalletsPeriodExpense;
        const eqSalesEl = document.getElementById("eqTodaySales");
        const eqInc1El = document.getElementById("eqTodayIncome1");
        const eqDebtEl = document.getElementById("eqTodayDebt");
        const eqInc2El = document.getElementById("eqTodayIncome2");
        const eqExpEl = document.getElementById("eqTodayExpense");
        const eqNetEl = document.getElementById("eqTodayNet");
        if (eqSalesEl) eqSalesEl.innerText = eqSales.toLocaleString("en-US", { maximumFractionDigits: 2 });
        if (eqInc1El) eqInc1El.innerText = allWalletsPeriodIncome.toLocaleString("en-US", { maximumFractionDigits: 2 });
        if (eqDebtEl) eqDebtEl.innerText = todayNewDebts.toLocaleString("en-US", { maximumFractionDigits: 2 });
        if (eqInc2El) eqInc2El.innerText = allWalletsPeriodIncome.toLocaleString("en-US", { maximumFractionDigits: 2 });
        if (eqExpEl) eqExpEl.innerText = allWalletsPeriodExpense.toLocaleString("en-US", { maximumFractionDigits: 2 });
        if (eqNetEl) {
            eqNetEl.innerText = eqNet.toLocaleString("en-US", { maximumFractionDigits: 2 });
            eqNetEl.className = `eq-num ${eqNet < 0 ? "red" : "green"}`;
        }
        const isDayMode = (activePeriodKey === "day");
        const periodWord = isDayMode ? "اليوم" : "الفترة";
        const incTileTitleEl = document.getElementById("homeIncomeTileTitle");
        const expTileTitleEl = document.getElementById("homeExpenseTileTitle");
        if (incTileTitleEl) incTileTitleEl.innerText = `دخل ${periodWord}`;
        if (expTileTitleEl) expTileTitleEl.innerText = `مصروفات ${periodWord}`;



        const histTileSubEl = document.getElementById("homeHistoryCountBanner");
        if (histTileSubEl) {
            const periodCnt = periodItems.length;
            histTileSubEl.innerText = periodCnt > 0 ? (isDayMode ? `${periodCnt} حركة اليوم` : `${periodCnt} حركة`) : "عرض الكل";
        }
        const credBannerEl = document.getElementById("homeTotalCreditsBanner");
        if (credBannerEl) credBannerEl.innerText = totalClientCredits.toLocaleString("en-US", { maximumFractionDigits: 2 });

        const sbNet = document.getElementById("sidebarNetBalance");
        const sbDebt = document.getElementById("sidebarDebtsBalance");
        const homeNetEl = document.getElementById("homeNetBalanceCardVal");
        const homeDebtEl = document.getElementById("homeDebtsBalanceCardVal");
        const netFormatted = totalNetAll.toLocaleString("en-US", { maximumFractionDigits: 2 });
        const debtFormatted = totalMarketDebts.toLocaleString("en-US", { maximumFractionDigits: 2 });
        if (sbNet) sbNet.innerText = netFormatted;
        if (sbDebt) sbDebt.innerText = debtFormatted;
        if (homeNetEl) homeNetEl.innerText = netFormatted;
        if (homeDebtEl) homeDebtEl.innerText = debtFormatted;

        // 1. تعبئة صفحة المصروفات الكاملة
        const expItems = periodItems.filter(t => t.type === "EXPENSE");
        const expTotal = expItems.reduce((s, t) => s + Number(t.amount || 0), 0);
        const expMap = {};
        expItems.forEach(t => {
            const cat = t.category || "أخرى";
            if (!expMap[cat]) expMap[cat] = { amount: 0, count: 0 };
            expMap[cat].amount += Number(t.amount || 0);
            expMap[cat].count++;
        });
        const expSearchQ = normalizeArabicText(document.getElementById("expensePageSearchInput")?.value || "");
        const expKeys = Object.keys(expMap)
            .filter(c => !expSearchQ || normalizeArabicText(c).includes(expSearchQ))
            .sort((a, b) => expMap[b].amount - expMap[a].amount);
        const expThemes = {};
        expKeys.forEach((c, i) => { expThemes[c] = NEON_PALETTE_ITEMS[i % NEON_PALETTE_ITEMS.length]; });
        renderMainCategoryCards(expMap, expKeys, expThemes, expTotal, "EXPENSE", "expenseFullCardsContainer");

        // 2. تعبئة صفحة الدخل الكاملة
        const incItems = periodItems.filter(t => t.type === "INCOME");
        const incTotal = incItems.reduce((s, t) => s + Number(t.amount || 0), 0);
        const incMap = {};
        incItems.forEach(t => {
            const cat = t.category || "أخرى";
            if (!incMap[cat]) incMap[cat] = { amount: 0, count: 0 };
            incMap[cat].amount += Number(t.amount || 0);
            incMap[cat].count++;
        });
        const incSearchQ = normalizeArabicText(document.getElementById("incomePageSearchInput")?.value || "");
        const incKeys = Object.keys(incMap)
            .filter(c => !incSearchQ || normalizeArabicText(c).includes(incSearchQ))
            .sort((a, b) => incMap[b].amount - incMap[a].amount);
        const incThemes = {};
        incKeys.forEach((c, i) => { incThemes[c] = NEON_PALETTE_ITEMS[i % NEON_PALETTE_ITEMS.length]; });
        renderMainCategoryCards(incMap, incKeys, incThemes, incTotal, "INCOME", "incomeFullCardsContainer");

        // 3. تعبئة صفحة الزبائن الكاملة
        const allActiveClients = Object.keys(clientLedgers).filter(c => !archivedClients.includes(c));
        const cliMap = {};
        allActiveClients.forEach(c => {
            const metrics = clientLedgers[c];
            if (clientsSubFilter === "DEBT" && metrics.debt <= 0) return;
            if (clientsSubFilter === "CREDIT" && metrics.credit <= 0) return;
            cliMap[c] = {
                amount: metrics.debt > 0 ? metrics.debt : (metrics.credit > 0 ? metrics.credit : (metrics.req || 1)),
                debt: metrics.debt,
                credit: metrics.credit,
                req: metrics.req,
                paid: metrics.paid,
                count: metrics.count
            };
        });
        const cliKeys = Object.keys(cliMap).sort((a, b) => {
            if (cliMap[b].debt !== cliMap[a].debt) return cliMap[b].debt - cliMap[a].debt;
            return cliMap[b].credit - cliMap[a].credit;
        });
        const cliThemes = {};
        cliKeys.forEach((c, i) => { cliThemes[c] = NEON_PALETTE_ITEMS[i % NEON_PALETTE_ITEMS.length]; });
        renderSelectedSearchClient();

        const catFilterBar = document.getElementById("categoryActiveFilterBar");
        if (selectedHistoryCategory) {
            catFilterBar.classList.add("is-visible");
            document.getElementById("activeFilteredCategoryName").innerText = selectedHistoryCategory;
        } else {
            catFilterBar.classList.remove("is-visible");
        }

        const kpiIncCard = document.getElementById("kpiFilterIncomeCard");
        const kpiExpCard = document.getElementById("kpiFilterExpenseCard");
        if (kpiIncCard) kpiIncCard.classList.toggle("is-filter-active", historyReportTypeFilter === "INCOME");
        if (kpiExpCard) kpiExpCard.classList.toggle("is-filter-active", historyReportTypeFilter === "EXPENSE");

        const searchInp = document.getElementById("historySearchInput");
        const searchQuery = normalizeArabicText(searchInp ? searchInp.value : "");
        const filteredHistory = historyScopeItems.filter(t => {
            if (historyReportTypeFilter !== "ALL" && t.type !== historyReportTypeFilter) return false;
            if (selectedHistoryWallet !== "ALL" && normalizeWalletName(t.wallet) !== normalizeWalletName(selectedHistoryWallet)) return false;
            if (selectedHistoryCategory && t.category !== selectedHistoryCategory) return false;
            if (searchQuery) {
                const hay = normalizeArabicText([t.category, t.note, t.client, t.wallet, t.amount, t.date].join(" "));
                if (!hay.includes(searchQuery)) return false;
            }
            return true;
        });
        renderHistoryStream(filteredHistory);
        renderHomeClientTransactions(timeRange);
        const catDetailModalEl = document.getElementById("categoryDetailModal");
        if (catDetailModalEl && catDetailModalEl.classList.contains("is-active-modal") && activeDetailCategory) {
            renderCategoryDetailModalContent();
        }
    }

    function renderHomeClientTransactions(timeRange) {
        const box = document.getElementById("homeClientTxContainer");
        const badge = document.getElementById("homeClientTxCountBadge");
        if (!box) return;

        const periodClientTx = clientTransactions.filter(t => checkItemInFilterRange(t, timeRange));
        if (badge) badge.innerText = `${periodClientTx.length} حركة`;

        box.innerHTML = "";
        if (periodClientTx.length === 0) {
            box.innerHTML = '<div class="empty-records-message">لا توجد حركات زبائن مسجلة لهذه الفترة</div>';
            return;
        }

        periodClientTx.forEach(t => {
            const isPay = Boolean(t.isPayment);
            const paidVal = Number(t.amount || 0);
            const reqVal = isPay ? 0 : (t.reqAmount !== undefined ? Number(t.reqAmount) : paidVal);
            const debtVal = isPay ? 0 : Math.max(0, reqVal - paidVal);
            const typeText = isPay ? "تسديد" : "فاتورة";
            const descText = (t.note || t.category || "").trim();

            const card = document.createElement("div");
            card.className = `unified-tx-card is-clickable ${isPay ? "is-payment" : "is-invoice"}`;
            card.setAttribute("data-client", t.client || "");
            card.onclick = function() {
                const c = this.getAttribute("data-client");
                if (c) navigateToClientStatement(c);
            };

            const avatarUrl = getCachedCustomerAvatar(t.client || "");
            const detailsHtml = `
                <div class="unified-tx-row2">
                    <span class="unified-tx-type-plain ${isPay ? "green" : "amber"}">${typeText}</span>
                    ${t.wallet ? `<span style="color:var(--text-muted);">•</span><span class="unified-tx-wallet-plain">${getWalletIconEmoji(t.wallet)}${escapeHTML(normalizeWalletName(t.wallet))}</span>` : ""}
                </div>
                <div class="unified-tx-row3">${formatDateWithTime(t)}</div>
            `;
            const belowNameHtml = avatarUrl
                ? `<div class="client-movement-details-inline">
                       <img src="${avatarUrl}" alt="" class="client-movement-avatar-48">
                       <div class="client-movement-details-col">${detailsHtml}</div>
                   </div>`
                : detailsHtml;

            card.innerHTML = `
                <div class="unified-tx-card-main">
                <div class="unified-tx-right">
                    <div class="unified-tx-row1">
                        <span class="unified-tx-title">${escapeHTML(t.client || "")}</span>
                    </div>
                    ${belowNameHtml}
                </div>
                </div>
                <div class="unified-tx-left-wrap">
                    <div class="unified-tx-left">
                        <div class="unified-tx-paid green">المدفوع: ${paidVal.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                        ${debtVal > 0 ? `<div class="unified-tx-debt">المتبقي دين: ${debtVal.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>` : ""}
                    </div>
                </div>
            `;
            box.appendChild(card);
        });
    }

    let selectedSearchClientName = null;

    function openClientsPageDropdown() {
        const inp = document.getElementById("clientsPageSearchInput");
        const q = (inp ? inp.value : "").trim();
        populateClientsPageDropdown(q);
    }

    function populateClientsPageDropdown(query) {
        const dd = document.getElementById("clientsPageSearchDropdown");
        if (!dd) return;
        const cleanQ = normalizeArabicText(query);
        const allClients = getAllClients();
        const matches = !cleanQ ? allClients : allClients.filter(c => normalizeArabicText(c).includes(cleanQ));

        if (matches.length === 0) {
            dd.innerHTML = '<div class="custom-dropdown-item is-empty-hint">لا يوجد زبائن مطابقين</div>';
        } else {
            dd.innerHTML = matches.map(c => {
                const m = computeClientLedger(c);
                const badge = m.debt > 0
                    ? `<span style="font-size:0.8rem; color:var(--neon-amber); direction:ltr;">دين: ${m.debt.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>`
                    : (m.credit > 0
                        ? `<span style="font-size:0.8rem; color:var(--neon-green); direction:ltr;">+${m.credit.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>`
                        : `<span style="font-size:0.78rem; color:var(--text-muted);">خالص</span>`);
                return `<div class="clients-page-dropdown-item" data-client="${escapeHTML(c)}" onclick="selectClientsPageClient(this.getAttribute('data-client'))"><span>${escapeHTML(c)}</span>${badge}</div>`;
            }).join("");
        }
        dd.classList.add("is-open");
    }

    function onClientsPageSearchInput(val) {
        const clearBtn = document.getElementById("clientsPageSearchClearBtn");
        if (clearBtn) clearBtn.classList.toggle("is-visible", Boolean((val || "").trim()) || Boolean(selectedSearchClientName));
        const cleanQ = normalizeArabicText(val);
        if (!cleanQ) {
            selectedSearchClientName = null;
            renderSelectedSearchClient();
            populateClientsPageDropdown("");
            return;
        }
        const allClients = getAllClients();
        const exact = allClients.find(c => normalizeArabicText(c) === cleanQ);
        if (exact) {
            selectedSearchClientName = exact;
            renderSelectedSearchClient();
        } else {
            const firstMatch = allClients.find(c => normalizeArabicText(c).includes(cleanQ));
            selectedSearchClientName = firstMatch || null;
            renderSelectedSearchClient();
        }
        populateClientsPageDropdown(val);
    }

    function selectClientsPageClient(clientName) {
        selectedSearchClientName = clientName;
        const inp = document.getElementById("clientsPageSearchInput");
        const clearBtn = document.getElementById("clientsPageSearchClearBtn");
        const dd = document.getElementById("clientsPageSearchDropdown");
        if (inp) inp.value = clientName;
        if (clearBtn) clearBtn.classList.add("is-visible");
        if (dd) dd.classList.remove("is-open");
        renderSelectedSearchClient();
    }

    function onExpenseSearchInput(val) {
        const btn = document.getElementById("expensePageSearchClearBtn");
        if (btn) btn.classList.toggle("is-visible", Boolean((val || "").trim()));
        renderMainState();
    }
    function clearExpenseSearch() {
        const inp = document.getElementById("expensePageSearchInput");
        const btn = document.getElementById("expensePageSearchClearBtn");
        if (inp) inp.value = "";
        if (btn) btn.classList.remove("is-visible");
        renderMainState();
    }
    function onIncomeSearchInput(val) {
        const btn = document.getElementById("incomePageSearchClearBtn");
        if (btn) btn.classList.toggle("is-visible", Boolean((val || "").trim()));
        renderMainState();
    }
    function clearIncomeSearch() {
        const inp = document.getElementById("incomePageSearchInput");
        const btn = document.getElementById("incomePageSearchClearBtn");
        if (inp) inp.value = "";
        if (btn) btn.classList.remove("is-visible");
        renderMainState();
    }

    function clearClientsPageSearch() {
        selectedSearchClientName = null;
        const inp = document.getElementById("clientsPageSearchInput");
        const clearBtn = document.getElementById("clientsPageSearchClearBtn");
        const dd = document.getElementById("clientsPageSearchDropdown");
        if (inp) inp.value = "";
        if (clearBtn) clearBtn.classList.remove("is-visible");
        if (dd) dd.classList.remove("is-open");
        renderSelectedSearchClient();
    }

    function renderSelectedSearchClient() {
        const panel = document.getElementById("clientsPageSelectedPanel");
        if (!panel) return;
        if (!selectedSearchClientName) {
            panel.classList.remove("is-visible");
            return;
        }
        panel.classList.add("is-visible");
        const metrics = computeClientLedger(selectedSearchClientName);
        document.getElementById("searchClientNameTitle").innerText = selectedSearchClientName;
        document.getElementById("searchClientReqVal").innerText = metrics.req.toLocaleString("en-US", { maximumFractionDigits: 2 });
        document.getElementById("searchClientPaidVal").innerText = metrics.paid.toLocaleString("en-US", { maximumFractionDigits: 2 });

        const debtLbl = document.getElementById("searchClientDebtLabel");
        const debtVal = document.getElementById("searchClientDebtVal");
        const cardEl = document.getElementById("searchClientSummaryCard");
        if (metrics.credit > 0) {
            if (debtLbl) debtLbl.innerText = "رصيد موجب (للزبون)";
            debtVal.innerText = "+" + metrics.credit.toLocaleString("en-US", { maximumFractionDigits: 2 });
            debtVal.style.color = "var(--neon-green)";
            if (cardEl) cardEl.classList.add("has-credit");
        } else {
            if (debtLbl) debtLbl.innerText = "الدين المتبقي";
            debtVal.innerText = metrics.debt.toLocaleString("en-US", { maximumFractionDigits: 2 });
            debtVal.style.color = metrics.debt > 0 ? "var(--neon-amber)" : "var(--text-secondary)";
            if (cardEl) cardEl.classList.remove("has-credit");
        }

        const stream = document.getElementById("searchClientTxStream");
        stream.innerHTML = "";
        const clientTx = clientTransactions
            .filter(t => t.client === selectedSearchClientName)
            .sort((a, b) => new Date(b.date) - new Date(a.date) || (Number(b.id) - Number(a.id)));

        if (clientTx.length === 0) {
            stream.innerHTML = '<div class="empty-records-message">لا توجد حركات مسجلة لهذا الزبون</div>';
            return;
        }

        clientTx.forEach(t => {
            const reqVal = t.isPayment ? 0 : (t.reqAmount !== undefined ? t.reqAmount : t.amount);
            const paidVal = t.amount;
            const debtValItem = t.isPayment ? 0 : Math.max(0, Number(reqVal) - Number(paidVal));
            const creditValItem = t.isPayment ? 0 : Math.max(0, Number(paidVal) - Number(reqVal));

            const card = document.createElement("div");
            card.className = `statement-unit-card ${t.isPayment ? "is-payment" : "is-invoice"}`;
            card.innerHTML = `
                <div class="statement-card-top-row" style="gap: 8px; align-items: flex-start;">
                    <div style="display:flex; align-items:flex-start; gap:9px; min-width:0; flex:1;">
                        ${getCardSquircleIconHtml(t.isPayment ? "is-payment" : "is-invoice")}
                        <div style="display:flex; flex-direction:column; gap:3px; min-width:0; flex:1;">
                            <div style="display:flex; align-items:center; gap:5px; min-width:0; flex-wrap:wrap;">
                                <span class="statement-card-desc">${escapeHTML((t.note === "فاتورة خدمة / مبيعات" ? "فاتورة مبيعات" : (t.note || t.category)))}</span>
                                <span class="statement-card-wallet-badge">• ${escapeHTML(normalizeWalletName(t.wallet))}</span>
                            </div>
                            <span class="statement-card-date-badge" style="text-align:right;">${formatDateWithTime(t)}</span>
                        </div>
                    </div>
                    <div class="action-dropdown-wrapper" style="flex-shrink:0;">
                        <button type="button" class="three-dots-btn" data-id="${t.id}" onclick="toggleActionMenu(event, this.getAttribute('data-id'))" title="خيارات الحركة">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2.2"/>
                                <circle cx="12" cy="12" r="2.2"/>
                                <circle cx="12" cy="19" r="2.2"/>
                            </svg>
                        </button>
                        <div class="action-dropdown-menu" id="actionMenu_${t.id}">
                            <button type="button" class="action-menu-item edit-item" data-id="${t.id}" onclick="onActionMenuEdit(this.getAttribute('data-id'))">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                <span>تعديل</span>
                            </button>
                            <button type="button" class="action-menu-item del-item" data-id="${t.id}" onclick="onActionMenuDelete(this.getAttribute('data-id'))">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                <span>حذف</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="statement-card-grid-metrics">
                    <div class="stmt-grid-cell">
                        <span class="stmt-cell-title">المطلوب</span>
                        <span class="stmt-cell-val" style="color:var(--text-main);">${Number(reqVal).toLocaleString("en-US")}</span>
                    </div>
                    <div class="stmt-grid-cell">
                        <span class="stmt-cell-title">المدفوع</span>
                        <span class="stmt-cell-val" style="color:var(--neon-green);">${Number(paidVal).toLocaleString("en-US")}</span>
                    </div>
                    <div class="stmt-grid-cell">
                        <span class="stmt-cell-title">${t.isPayment ? "النوع" : (creditValItem > 0 ? "فائض مدفوع" : "الدين المسجل")}</span>
                        <span class="stmt-cell-val" style="color:${(t.isPayment || creditValItem > 0) ? "var(--neon-green)" : "var(--neon-amber)"};">${t.isPayment ? "سند قبض" : (creditValItem > 0 ? "+" + Number(creditValItem).toLocaleString("en-US") : Number(debtValItem).toLocaleString("en-US"))}</span>
                    </div>
                </div>
            `;
            stream.appendChild(card);
        });
    }

    function renderMainCategoryCards(catMap, sortedCats, catThemes, total, type, targetId = "expenseFullCardsContainer") {
        const box = document.getElementById(targetId);
        if (!box) return;
        box.innerHTML = "";
        if (sortedCats.length === 0) {
            box.innerHTML = '<div class="empty-records-message">لا توجد حركات مسجلة لهذه الفترة</div>';
            return;
        }
        sortedCats.forEach(cat => {
            const d = catMap[cat];
            const pct = total > 0 ? (d.amount / total) * 100 : 0;
            const theme = catThemes[cat];
            const card = document.createElement("div");
            card.className = "category-glass-card";
            card.setAttribute("data-cat", cat);
            card.onclick = function() { openCategoryDetailModal(this.getAttribute("data-cat"), type); };
            const catIconType = type === "INCOME" ? "is-income" : "is-expense";
            card.innerHTML = `
                <div class="cat-right-flex">
                    ${getCardSquircleIconHtml(catIconType)}
                    <div>
                        <div class="cat-title-string">${escapeHTML(cat)}</div>
                        <div class="cat-count-string">${d.count} حركة • تفاصيل</div>
                    </div>
                </div>
                <div class="cat-left-flex">
                    <div class="cat-val-number" style="color: ${theme.text};">${d.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                    <div class="cat-ratio-number" style="color: ${theme.text};">${pct.toFixed(1)}%</div>
                </div>
            `;
            box.appendChild(card);
        });
    }

    function renderClientsAsCategoryCards(clientsMap, sortedClients, clientThemes, targetId = "clientsFullCardsContainer") {
        const box = document.getElementById(targetId);
        if (!box) return;
        box.innerHTML = "";
        if (sortedClients.length === 0) {
            box.innerHTML = '<div class="empty-records-message">لا يوجد زبائن مسجلين حالياً. اضغط على زر (+) لإضافة فاتورة زبون جديدة</div>';
            return;
        }

        sortedClients.forEach(clientName => {
            const d = clientsMap[clientName];
            const theme = clientThemes[clientName];
            const card = document.createElement("div");
            card.className = "category-glass-card";
            card.style.borderTop = `3.5px solid ${theme.color}`;
            card.setAttribute("data-client", clientName);
            card.onclick = function() { navigateToClientStatement(this.getAttribute("data-client")); };

            const hasDebt = d.debt > 0;
            const hasCredit = d.credit > 0;
            const debtBadgeColor = hasDebt ? "var(--neon-amber)" : "var(--neon-green)";
            let statusText = "خالص";
            if (hasDebt) statusText = d.debt.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " دَين";
            else if (hasCredit) statusText = "+" + d.credit.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " رصيد موجب";

            card.innerHTML = `
                <div class="cat-right-flex">
                    <span class="cat-neon-indicator" style="background: ${theme.color};"></span>
                    <div>
                        <div class="cat-title-string">${escapeHTML(clientName)}</div>
                        <div class="cat-count-string">${d.count} حركة • كشف حساب</div>
                    </div>
                </div>
                <div class="cat-left-flex">
                    <div class="cat-val-number" style="color: ${debtBadgeColor};">
                        ${statusText}
                    </div>
                    <div class="cat-ratio-number" style="color: var(--text-muted);">
                        مطلوب: ${d.req.toLocaleString("en-US")} | مقبوض: ${d.paid.toLocaleString("en-US")}
                    </div>
                </div>
            `;
            box.appendChild(card);
        });
    }

    function renderHistoryStream(list) {
        const box = document.getElementById("historyStreamContainer");
        const countBadge = document.getElementById("historyRecordsBadgeCount");
        box.innerHTML = "";
        countBadge.innerText = `${list.length} حركة`;

        if (list.length === 0) {
            box.innerHTML = '<div class="empty-records-message">لا توجد حركات مسجلة ضمن هذا التحديد</div>';
            return;
        }

        list.forEach(tx => {
            const isInc = tx.type === "INCOME";
            const isClient = Boolean(tx.client);
            const isPay = Boolean(tx.isPayment);
            const row = document.createElement("div");

            let cardStateCls = isInc ? "is-income" : "is-expense";
            let badgeCls = isInc ? "is-income" : "is-expense";
            let badgeText = isInc ? "دخل" : "مصروف";
            if (isClient) {
                cardStateCls = isPay ? "is-payment" : "is-invoice";
                badgeCls = isPay ? "is-payment" : "is-invoice";
                badgeText = isPay ? "سداد" : "فاتورة";
            }
            row.className = `unified-tx-card ${cardStateCls}`;

            const titleText = isClient ? escapeHTML(tx.client) : escapeHTML(tx.category || "");
            const descText = isClient
                ? escapeHTML(tx.note || tx.category || "")
                : escapeHTML(tx.note || "");

            const paidVal = Number(tx.amount || 0);
            const reqVal = (isClient && !isPay && tx.reqAmount !== undefined) ? Number(tx.reqAmount) : paidVal;
            const debtVal = (isClient && !isPay) ? Math.max(0, reqVal - paidVal) : 0;

            const leftAmountHtml = isClient
                ? `<div class="unified-tx-paid green">المدفوع: ${paidVal.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>
                   ${debtVal > 0 ? `<div class="unified-tx-debt">المتبقي دين: ${debtVal.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>` : ""}`
                : `<div class="unified-tx-paid ${isInc ? 'green' : 'red'}">${isInc ? '+' : '-'}${paidVal.toLocaleString("en-US", { maximumFractionDigits: 2 })}</div>`;

            const row1Html = isClient
                ? `<span class="unified-tx-title">${titleText}</span>`
                : `<span class="unified-tx-title">${titleText}</span><span class="unified-tx-badge ${badgeCls}">${badgeText}</span>`;

            const row2Html = isClient
                ? `<span class="unified-tx-type-plain ${isPay ? 'green' : 'amber'}">${badgeText}</span>
                   ${tx.wallet ? `<span style="color:var(--text-muted);">•</span><span class="unified-tx-wallet-plain">${getWalletIconEmoji(tx.wallet)}${escapeHTML(normalizeWalletName(tx.wallet))}</span>` : ""}`
                : `${tx.wallet ? `<span class="record-wallet-badge">${getWalletIconEmoji(tx.wallet)}${escapeHTML(normalizeWalletName(tx.wallet))}</span>` : ""}
                   ${descText ? `<span class="unified-tx-desc">${descText}</span>` : ""}`;

            row.innerHTML = `
                <div class="unified-tx-card-main">
                <div class="unified-tx-right">
                    <div class="unified-tx-row1">${row1Html}</div>
                    <div class="unified-tx-row2">${row2Html}</div>
                    <div class="unified-tx-row3">${formatDateWithTime(tx)}</div>
                </div>
                </div>
                <div class="unified-tx-left-wrap">
                    <div class="unified-tx-left-top-actions">
                    ${!isClient ? getCardSquircleIconHtml(cardStateCls) : ''}
                    <div class="action-dropdown-wrapper">
                        <button type="button" class="three-dots-btn" data-id="${tx.id}" onclick="toggleActionMenu(event, this.getAttribute('data-id'))" title="خيارات التعديل والحذف">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2.2"/>
                                <circle cx="12" cy="12" r="2.2"/>
                                <circle cx="12" cy="19" r="2.2"/>
                            </svg>
                        </button>
                        <div class="action-dropdown-menu" id="actionMenu_${tx.id}">
                            <button type="button" class="action-menu-item edit-item" data-id="${tx.id}" onclick="onActionMenuEdit(this.getAttribute('data-id'))">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                <span>تعديل</span>
                            </button>
                            <button type="button" class="action-menu-item del-item" data-id="${tx.id}" onclick="onActionMenuDelete(this.getAttribute('data-id'))">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                <span>حذف</span>
                            </button>
                        </div>
                    </div>
                    </div>
                    <div class="${isClient ? 'unified-tx-left' : 'unified-tx-left-bottom-amt'}">
                        ${leftAmountHtml}
                    </div>
                </div>
            `;
            box.appendChild(row);
        });
    }

    function renderClientStatement() {
        if (!activeStatementClient) return;
        document.getElementById("statementClientName").innerText = activeStatementClient;
        updateStatementAvatarPreview(activeStatementClient);
        const metrics = computeClientLedger(activeStatementClient);
        document.getElementById("stmtReqVal").innerText = metrics.req.toLocaleString("en-US", { maximumFractionDigits: 2 });
        document.getElementById("stmtPaidVal").innerText = metrics.paid.toLocaleString("en-US", { maximumFractionDigits: 2 });

        const debtLabelEl = document.getElementById("stmtDebtLabel");
        const debtValEl = document.getElementById("stmtDebtVal");
        const headerCardEl = document.querySelector(".client-statement-header-card");
        if (metrics.credit > 0) {
            if (debtLabelEl) debtLabelEl.innerText = "رصيد موجب (للزبون)";
            debtValEl.innerText = "+" + metrics.credit.toLocaleString("en-US", { maximumFractionDigits: 2 });
            debtValEl.style.color = "var(--neon-green)";
            if (headerCardEl) headerCardEl.classList.add("has-credit");
        } else {
            if (debtLabelEl) debtLabelEl.innerText = "الدين المتبقي";
            debtValEl.innerText = metrics.debt.toLocaleString("en-US", { maximumFractionDigits: 2 });
            debtValEl.style.color = metrics.debt > 0 ? "var(--neon-amber)" : "var(--text-secondary)";
            if (headerCardEl) headerCardEl.classList.remove("has-credit");
        }

        const cardsContainer = document.getElementById("statementCardsStream");
        cardsContainer.innerHTML = "";

        const clientTx = clientTransactions.filter(t => t.client === activeStatementClient)
                                        .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (clientTx.length === 0) {
            cardsContainer.innerHTML = '<div class="empty-records-message">لا توجد حركات مسجلة لهذا الزبون</div>';
            return;
        }

        clientTx.forEach(t => {
            const reqVal = t.isPayment ? 0 : (t.reqAmount !== undefined ? t.reqAmount : t.amount);
            const paidVal = t.amount;
            const debtVal = t.isPayment ? 0 : Math.max(0, Number(reqVal) - Number(paidVal));
            const creditVal = t.isPayment ? 0 : Math.max(0, Number(paidVal) - Number(reqVal));

            const card = document.createElement("div");
            card.className = `statement-unit-card ${t.isPayment ? "is-payment" : "is-invoice"}`;
            card.innerHTML = `
                <div class="statement-card-top-row" style="gap: 8px; align-items: flex-start;">
                    <div style="display:flex; align-items:flex-start; gap:9px; min-width:0; flex:1;">
                        ${getCardSquircleIconHtml(t.isPayment ? "is-payment" : "is-invoice")}
                        <div style="display:flex; flex-direction:column; gap:3px; min-width:0; flex:1;">
                            <div style="display:flex; align-items:center; gap:5px; min-width:0; flex-wrap:wrap;">
                                <span class="statement-card-desc">${escapeHTML((t.note === "فاتورة خدمة / مبيعات" ? "فاتورة مبيعات" : (t.note || t.category)))}</span>
                                <span class="statement-card-wallet-badge">• ${escapeHTML(normalizeWalletName(t.wallet))}</span>
                            </div>
                            <span class="statement-card-date-badge" style="text-align:right;">${formatDateWithTime(t)}</span>
                        </div>
                    </div>
                    <div class="action-dropdown-wrapper" style="flex-shrink:0;">
                        <button type="button" class="three-dots-btn" data-id="${t.id}" onclick="toggleActionMenu(event, this.getAttribute('data-id'))" title="خيارات الحركة">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <circle cx="12" cy="5" r="2.2"/>
                                <circle cx="12" cy="12" r="2.2"/>
                                <circle cx="12" cy="19" r="2.2"/>
                            </svg>
                        </button>
                        <div class="action-dropdown-menu" id="actionMenu_${t.id}">
                            <button type="button" class="action-menu-item edit-item" data-id="${t.id}" onclick="onActionMenuEdit(this.getAttribute('data-id'))">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                                <span>تعديل</span>
                            </button>
                            <button type="button" class="action-menu-item del-item" data-id="${t.id}" onclick="onActionMenuDelete(this.getAttribute('data-id'))">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                <span>حذف</span>
                            </button>
                        </div>
                    </div>
                </div>
                <div class="statement-card-grid-metrics">
                    <div class="stmt-grid-cell">
                        <span class="stmt-cell-title">المطلوب</span>
                        <span class="stmt-cell-val" style="color:var(--text-main);">${Number(reqVal).toLocaleString("en-US")}</span>
                    </div>
                    <div class="stmt-grid-cell">
                        <span class="stmt-cell-title">المدفوع</span>
                        <span class="stmt-cell-val" style="color:var(--neon-green);">${Number(paidVal).toLocaleString("en-US")}</span>
                    </div>
                    <div class="stmt-grid-cell">
                        <span class="stmt-cell-title">${t.isPayment ? "النوع" : (creditVal > 0 ? "فائض مدفوع" : "الدين المسجل")}</span>
                        <span class="stmt-cell-val" style="color:${(t.isPayment || creditVal > 0) ? "var(--neon-green)" : "var(--neon-amber)"};">${t.isPayment ? "سند قبض" : (creditVal > 0 ? "+" + Number(creditVal).toLocaleString("en-US") : Number(debtVal).toLocaleString("en-US"))}</span>
                    </div>
                </div>
            `;
            cardsContainer.appendChild(card);
        });
    }

    function updateDateLabelDisplay() {
        const d = activeRefDate;
        const lbl = document.getElementById("displayActiveDateText");
        if (!lbl) return;
        const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");

        if (activePeriodKey === "day") lbl.innerText = `${y}/${m}/${day}`;
        else if (activePeriodKey === "month") lbl.innerText = `${y}/${m}`;
        else if (activePeriodKey === "week") {
            const ty = d.getFullYear(), tm = d.getMonth(), td = d.getDate();
            const dObj = new Date(ty, tm, td), dayOfWeek = dObj.getDay();
            const firstDate = new Date(ty, tm, td - dayOfWeek);
            const lastDate = new Date(ty, tm, td - dayOfWeek + 6);
            lbl.innerText = `${formatNumericDateSlash(firstDate)} ~ ${formatNumericDateSlash(lastDate)}`;
        } else if (activePeriodKey === "custom") {
            lbl.innerText = `${customPickedStartDate.replace(/-/g, '/')} → ${(customPickedEndDate || formatISODate(new Date())).replace(/-/g, '/')}`;
        }
    }

    function getAllClients() {
        const set = new Set([...savedClients, ...clientTransactions.map(t => t.client).filter(Boolean)]);
        return [...set].filter(c => !archivedClients.includes(c));
    }

    function isClientUsedInTransactions(clientName) {
        return clientTransactions.some(t => t.client === clientName);
    }

    function registerNewClientIfMissing(client) {
        const clean = (client || "").trim();
        if (!clean) return;
        if (!savedClients.includes(clean)) {
            savedClients.unshift(clean);
            saveClientsStorage();
        }
    }

    function updateClientsDatalist() { populateClientDropdown(getAllClients()); }

    function populateClientDropdown(clients) {
        const list = document.getElementById("clientDropdownList");
        if (!list) return;
        list.innerHTML = "";
        if (!clients || clients.length === 0) {
            list.innerHTML = '<div class="custom-dropdown-item is-empty-hint">لا توجد أسماء زبائن مطابقة (سيتم حفظ الاسم الجديد تلقائياً)</div>';
            return;
        }
        clients.forEach(c => {
            const item = document.createElement("div");
            item.className = "custom-dropdown-item";

            const nameSpan = document.createElement("span");
            nameSpan.className = "custom-dropdown-cat-name";
            nameSpan.textContent = c;
            nameSpan.onclick = function() { selectClientFromDropdown(c); };

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "custom-dropdown-del-btn";
            delBtn.textContent = "✕";
            delBtn.title = "حذف هذا الزبون إذا كان فارغاً";
            delBtn.onclick = function(e) { e.stopPropagation(); removeClient(c); };

            item.appendChild(nameSpan);
            item.appendChild(delBtn);
            list.appendChild(item);
        });
    }

    function removeClient(c) {
        if (isClientUsedInTransactions(c)) {
            displayToast(`لا يمكن حذف الزبون "${c}" لوجود حركات مالية مسجلة له!`, true);
            return;
        }
        const doDel = () => {
            savedClients = savedClients.filter(item => item !== c);
            const invClientInp = document.getElementById("invClientName");
            if (invClientInp && invClientInp.value === c) invClientInp.value = "";
            saveClientsStorage();
            populateClientDropdown(getAllClients());
            displayToast(`تم حذف الزبون الفارغ "${c}"`);
        };
        promptConfirmDialog("حذف زبون", `هل أنت متأكد من حذف الزبون "${c}"؟`, doDel, true, "تأكيد الحذف");
    }

    function openClientDropdown(populateAll = false, forceShowEmpty = false) {
        const panel = document.getElementById("clientDropdownPanel");
        const wrapper = document.getElementById("clientDropdownWrapper");
        if (!panel) return;
        const allClients = getAllClients();
        const currentVal = (populateAll ? "" : (document.getElementById("invClientName")?.value || "")).trim().toLowerCase();
        if (currentVal) {
            handleClientInputTyping(currentVal);
            return;
        }
        if (allClients.length === 0 && !forceShowEmpty) {
            closeClientDropdown();
            return;
        }
        populateClientDropdown(allClients);
        panel.style.display = "block";
        if (wrapper) wrapper.classList.add("is-open");
    }

    function closeClientDropdown() {
        const panel = document.getElementById("clientDropdownPanel");
        const wrapper = document.getElementById("clientDropdownWrapper");
        if (panel) panel.style.display = "none";
        if (wrapper) wrapper.classList.remove("is-open");
    }

    function toggleClientDropdown(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        const panel = document.getElementById("clientDropdownPanel");
        if (panel && panel.style.display === "block") closeClientDropdown();
        else {
            openClientDropdown(true, true);
            const inp = document.getElementById("invClientName");
            if (inp) inp.focus();
        }
    }

    function handleClientInputFocus(el) {
        if (!el) return;
        setCaretToEnd(el);
        openClientDropdown();
    }

    function handleClientInputTyping(query) {
        const cleanQuery = (query || "").trim().toLowerCase();
        const panel = document.getElementById("clientDropdownPanel");
        const wrapper = document.getElementById("clientDropdownWrapper");
        if (panel) panel.style.display = "block";
        if (wrapper) wrapper.classList.add("is-open");

        const allClients = getAllClients();
        const matches = !cleanQuery ? allClients : allClients.filter(c => c.toLowerCase().includes(cleanQuery));
        if (matches.length === 0) {
            closeClientDropdown();
            updateInvoiceModalAvatarPreview();
            return;
        }
        populateClientDropdown(matches);
        updateInvoiceModalAvatarPreview();
    }

    function selectClientFromDropdown(clientName) {
        const inp = document.getElementById("invClientName");
        if (inp) inp.value = clientName;
        closeClientDropdown();
        updateInvoiceModalAvatarPreview();
    }

    function openAddTransactionModal(defaultType = null) {
        editingRecordId = null;
        closeCategoryDropdown();
        document.getElementById("modalSheetFormTitle").innerText = "إضافة حركة مالية";
        document.getElementById("btnSubmitTxRecord").innerText = "حفظ الحركة";
        document.getElementById("inputTxAmount").value = "";
        document.getElementById("inputTxCategory").value = "";
        document.getElementById("inputTxNote").value = "";
        setModalTransactionType(defaultType || (currentMainType === "INCOME" ? "INCOME" : "EXPENSE"));
        if (paymentWallets.length > 0) pickModalWallet(paymentWallets[0]);
        renderCategoriesDatalistAndChips();
        updateModalWalletBalancePreview();
        openGlassModal("addTxModalSheet");
    }

    function beginEditTx(id) {
        closeAllActionMenus();
        const tx = allTransactions.find(t => t.id == id) || clientTransactions.find(t => t.id == id);
        if (!tx) return;

        if (tx.client) {
            if (tx.isPayment) openClientPaymentModalForEdit(tx);
            else openClientInvoiceModalForEdit(tx);
            return;
        }

        editingRecordId = tx.id;
        closeCategoryDropdown();
        document.getElementById("modalSheetFormTitle").innerText = "تعديل حركة مالية";
        document.getElementById("btnSubmitTxRecord").innerText = "تحديث الحركة";
        document.getElementById("inputTxAmount").value = formatNumberWithCommas(tx.amount);
        document.getElementById("inputTxCategory").value = tx.category;
        document.getElementById("inputTxNote").value = tx.note || "";
        setModalTransactionType(tx.type);
        pickModalWallet(tx.wallet);
        renderCategoriesDatalistAndChips();
        updateModalWalletBalancePreview();
        openGlassModal("addTxModalSheet");
    }

    function openClientInvoiceModalForEdit(tx) {
        editingInvoiceId = tx.id;
        closeClientDropdown();
        document.getElementById("clientInvoiceModalTitle").innerText = "تعديل فاتورة زبون";
        document.getElementById("btnCommitClientInvoice").innerText = "تحديث الفاتورة";
        document.getElementById("invClientName").value = tx.client || "";
        document.getElementById("invTotalAmount").value = formatNumberWithCommas(tx.reqAmount !== undefined ? tx.reqAmount : tx.amount);
        document.getElementById("invPaidAmount").value = formatNumberWithCommas(tx.amount);
        recalcInvoiceDebtPreview();
        document.getElementById("invDesc").value = tx.note || "";
        if (tx.wallet) document.getElementById("clientInvoiceMethod").value = tx.wallet;
        syncWalletPickerDisplays();
        populateClientDropdown(getAllClients());
        updateInvoiceModalAvatarPreview();
        openGlassModal("clientInvoiceModal");
    }

    function openClientPaymentModalForEdit(tx) {
        editingPaymentId = tx.id;
        document.getElementById("clientPaymentModalTitle").innerText = "تعديل سند قبض / سداد دَين";
        document.getElementById("btnCommitClientPayment").innerText = "تحديث سند القبض";
        document.getElementById("payClientName").value = tx.client || "";
        document.getElementById("clientSettlementAmount").value = formatNumberWithCommas(tx.amount);
        document.getElementById("clientSettlementDate").value = tx.date;
        document.getElementById("payNote").value = tx.note || "سداد دفعة من الدَّين";
        if (tx.wallet) document.getElementById("clientSettlementMethod").value = tx.wallet;
        syncWalletPickerDisplays();
        openGlassModal("clientPaymentModal");
    }

    function setModalTransactionType(t) {
        modalActiveTxType = t;
        document.getElementById("btnModalTypeExpense").classList.toggle("active", t === "EXPENSE");
        document.getElementById("btnModalTypeIncome").classList.toggle("active", t === "INCOME");
        const catInp = document.getElementById("inputTxCategory");
        if (catInp) catInp.placeholder = t === "INCOME" ? "اختر أو اكتب تصنيف الدخل..." : "اختر أو اكتب تصنيف المصروف...";

        const isEdit = editingRecordId != null;
        const titleEl = document.getElementById("modalSheetFormTitle");
        const submitBtn = document.getElementById("btnSubmitTxRecord");
        const walletLbl = document.getElementById("modalWalletFieldLabel");
        const modalSheet = document.querySelector("#addTxModalSheet .glass-modal-sheet");

        if (t === "INCOME") {
            if (titleEl) {
                titleEl.innerText = isEdit ? "تعديل دخل" : "إضافة دخل جديد";
                titleEl.style.color = "var(--neon-green)";
            }
            if (submitBtn) {
                submitBtn.innerText = isEdit ? "تحديث الدخل" : "حفظ الدخل";
                submitBtn.style.background = "linear-gradient(135deg, #10B981 0%, #059669 100%)";
            }
            if (walletLbl) walletLbl.innerText = "وسيلة القبض";
            if (modalSheet) modalSheet.style.borderTopColor = "#10B981";
        } else {
            if (titleEl) {
                titleEl.innerText = isEdit ? "تعديل مصروف" : "إضافة مصروف جديد";
                titleEl.style.color = "var(--neon-red)";
            }
            if (submitBtn) {
                submitBtn.innerText = isEdit ? "تحديث المصروف" : "حفظ المصروف";
                submitBtn.style.background = "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)";
            }
            if (walletLbl) walletLbl.innerText = "وسيلة الدفع";
            if (modalSheet) modalSheet.style.borderTopColor = "#EF4444";
        }

        renderCategoriesDatalistAndChips();
        updateModalWalletBalancePreview();
    }

    let currentActiveWalletTargetSelectId = null;

    function saveAppTitleFromSettings() {
        const inp = document.getElementById("appTitleSettingInput");
        const val = (inp ? inp.value : "").trim();
        handleAppTitleChange(val);
        displayToast(val ? ("تم حفظ اسم البرنامج: " + val) : "تم حفظ التعديل بنجاح");
    }

    function syncWalletPickerDisplays() {
        const targets = [
            { selId: "modalTxWalletSelect", dispId: "modalTxWalletSelectDisplay" },
            { selId: "clientInvoiceMethod", dispId: "clientInvoiceMethodDisplay" },
            { selId: "clientSettlementMethod", dispId: "clientSettlementMethodDisplay" }
        ];
        targets.forEach(t => {
            const sel = document.getElementById(t.selId);
            const disp = document.getElementById(t.dispId);
            if (sel && disp) disp.innerText = sel.value || (paymentWallets[0] || "كاش");
        });
    }

    function openWalletPickerModal(targetSelectId) {
        currentActiveWalletTargetSelectId = targetSelectId;
        const targetSelect = document.getElementById(targetSelectId);
        const currentVal = targetSelect ? targetSelect.value : (paymentWallets[0] || "");
        const container = document.getElementById("walletPickerCardsContainer");

        if (container) {
            let html = "";
            paymentWallets.forEach(w => {
                const isSelected = (w === currentVal);
                const bal = getWalletBalance(w, editingRecordId);
                const balFormatted = bal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                let balColorStyle = "color: var(--text-secondary);";
                if (bal > 0) balColorStyle = "color: var(--neon-green);";
                else if (bal < 0) balColorStyle = "color: var(--neon-red);";

                html += `
                    <div class="wallet-option-card ${isSelected ? 'is-selected' : ''}" onclick="selectWalletOption('${escapeHTML(w)}')">
                        <div class="wallet-option-card-right">
                            <div class="wallet-option-icon ${isSelected ? 'is-active' : ''}">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                                    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                                    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
                                </svg>
                            </div>
                            <div class="wallet-option-info">
                                <span class="wallet-option-name">${escapeHTML(w)}</span>
                                <span class="wallet-option-balance" style="${balColorStyle}">الرصيد: ${balFormatted}</span>
                            </div>
                        </div>
                        <div class="wallet-option-check">
                            ${isSelected ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>` : ''}
                        </div>
                    </div>
                `;
            });
            container.innerHTML = html;
        }
        openGlassModal("walletPickerGlassModal");
    }

    function selectWalletOption(walletName) {
        if (currentActiveWalletTargetSelectId) {
            const sel = document.getElementById(currentActiveWalletTargetSelectId);
            if (sel) {
                sel.value = walletName;
                sel.dispatchEvent(new Event("change"));
            }
            if (currentActiveWalletTargetSelectId === "modalTxWalletSelect") {
                modalSelectedWallet = walletName;
                updateModalWalletBalancePreview();
            }
            syncWalletPickerDisplays();
        }
        closeGlassModal("walletPickerGlassModal");
    }

    function pickModalWallet(w) {
        modalSelectedWallet = w;
        const sel = document.getElementById("modalTxWalletSelect");
        if (sel) sel.value = w;
        syncWalletPickerDisplays();
        updateModalWalletBalancePreview();
    }

    function executeCommitTransaction() {
        const amtStr = document.getElementById("inputTxAmount").value;
        const amount = parseNumberSafe(amtStr, NaN);
        const category = (document.getElementById("inputTxCategory").value || "").trim();
        const date = formatISODate(new Date());
        const note = (document.getElementById("inputTxNote").value || "").trim();
        const wallet = document.getElementById("modalTxWalletSelect").value || modalSelectedWallet;

        if (isNaN(amount) || amount <= 0) { displayToast("يرجى إدخال مبلغ صحيح أكبر من صفر", true); return; }
        if (!category) { displayToast("يرجى إدخال أو اختيار التصنيف", true); return; }

        const saveCallback = () => {
            registerNewCategoryIfMissing(category, modalActiveTxType);

            if (editingRecordId != null) {
                const idx = allTransactions.findIndex(t => t.id == editingRecordId);
                if (idx !== -1) {
                    const updatedTx = { ...allTransactions[idx], amount, category, type: modalActiveTxType, wallet, date, note };
                    if (updatedTx.client && !updatedTx.isPayment && updatedTx.reqAmount !== undefined) {
                        updatedTx.debtAmount = Math.max(0, Number(updatedTx.reqAmount) - amount);
                    }
                    allTransactions[idx] = updatedTx;
                    displayToast("تم تحديث الحركة بنجاح");
                }
                editingRecordId = null;
            } else {
                allTransactions.unshift({ id: Date.now(), amount, wallet, category, type: modalActiveTxType, date, time: formatCurrentTime12h(), note });
                displayToast("تم حفظ الحركة بنجاح");
            }

            saveStorage();
            closeGlassModal("addTxModalSheet");
            renderMainState();
            const catDetailModal = document.getElementById("categoryDetailModal");
            if (catDetailModal && catDetailModal.classList.contains("is-active-modal")) {
                renderCategoryDetailModalContent();
            }
        };

        if (modalActiveTxType === "EXPENSE") {
            const availBal = getWalletBalance(wallet, editingRecordId);
            if (normalizeWalletName(wallet) !== "كاش") {
                if (availBal <= 0) { displayToast(`لا يمكن الصرف من وسيلة (${wallet})؛ رصيدها فارغ (0.00)!`, true); return; }
                if (amount > availBal) { displayToast(`المبلغ المطلوب (${amount.toLocaleString('en-US')}) أكبر من الرصيد المتوفر في (${wallet}) وهو (${availBal.toLocaleString('en-US', {maximumFractionDigits: 2})})!`, true); return; }
            } else if (amount > availBal) {
                promptConfirmDialog(
                    "تنبيه: الصرف بالدَّين من الكاش",
                    "رصيد الكاش المتوفر (" + availBal.toLocaleString('en-US', {maximumFractionDigits: 2}) + ") أقل من المبلغ المطلوب. سيصبح رصيد الكاش (" + (Math.round((availBal - amount) * 100) / 100).toLocaleString('en-US', {maximumFractionDigits: 2}) + ") كعجز على الصندوق. هل تريد المتابعة؟",
                    saveCallback,
                    false,
                    "متابعة"
                );
                return;
            }
        }

        saveCallback();
    }

    function openClientInvoiceModal(defaultClient = "") {
        editingInvoiceId = null;
        closeClientDropdown();
        document.getElementById("clientInvoiceModalTitle").innerText = "فاتورة مبيعات لزبون";
        document.getElementById("btnCommitClientInvoice").innerText = "حفظ الفاتورة وترحيل الأرصدة";
        document.getElementById("invClientName").value = defaultClient || "";
        document.getElementById("invTotalAmount").value = "";
        document.getElementById("invPaidAmount").value = "";
        recalcInvoiceDebtPreview();
        document.getElementById("invDesc").value = "";
        if (paymentWallets.length > 0) document.getElementById("clientInvoiceMethod").value = paymentWallets[0];
        syncWalletPickerDisplays();
        populateClientDropdown(getAllClients());
        updateInvoiceModalAvatarPreview();
        openGlassModal("clientInvoiceModal");
    }

    function recalcInvoiceDebtPreview() {
        const total = parseNumberSafe(document.getElementById("invTotalAmount").value, 0);
        const paid = parseNumberSafe(document.getElementById("invPaidAmount").value, 0);
        const box = document.getElementById("invDebtPreviewBox");
        const lbl = document.getElementById("invDebtPreviewLabel");
        const disp = document.getElementById("invDebtPreview");
        if (!disp) return;
        if (paid > total) {
            const credit = paid - total;
            disp.innerText = "+" + credit.toLocaleString("en-US", { maximumFractionDigits: 2 });
            disp.style.color = "var(--neon-green)";
            if (lbl) { lbl.innerText = "رصيد موجب للزبون (للمرة القادمة):"; lbl.style.color = "var(--neon-green)"; }
            if (box) { box.style.background = "var(--neon-green-subtle)"; box.style.borderColor = "var(--neon-green-border)"; }
        } else {
            const debt = Math.max(0, total - paid);
            disp.innerText = debt.toLocaleString("en-US", { maximumFractionDigits: 2 });
            disp.style.color = "var(--neon-amber)";
            if (lbl) { lbl.innerText = "المتبقي كدَين مسجل:"; lbl.style.color = "var(--neon-amber)"; }
            if (box) { box.style.background = "var(--neon-amber-subtle)"; box.style.borderColor = "var(--neon-amber-border)"; }
        }
    }

    function executeCommitClientInvoice() {
        const client = (document.getElementById("invClientName").value || "").trim();
        const total = parseNumberSafe(document.getElementById("invTotalAmount").value, NaN);
        const paid = parseNumberSafe(document.getElementById("invPaidAmount").value, 0);
        const wallet = document.getElementById("clientInvoiceMethod").value || (paymentWallets[0] || "كاش");
        const date = formatISODate(new Date());
        const desc = (document.getElementById("invDesc").value || "").trim() || "فاتورة مبيعات";

        if (!client) { displayToast("يرجى كتابة أو اختيار اسم الزبون", true); return; }
        if (isNaN(total) || total < 0) { displayToast("يرجى كتابة إجمالي المطلوب بشكل صحيح", true); return; }
        if (total === 0 && paid <= 0) { displayToast("يرجى إدخال المبلغ المطلوب أو المدفوع", true); return; }

        const debt = Math.max(0, total - paid);
        if (archivedClients.includes(client)) {
            archivedClients = archivedClients.filter(c => c !== client);
            saveArchivedStorage();
        }

        registerNewClientIfMissing(client);

        if (editingInvoiceId != null) {
            const idx = clientTransactions.findIndex(t => t.id == editingInvoiceId);
            if (idx !== -1) {
                clientTransactions[idx] = { ...clientTransactions[idx], client, amount: paid, reqAmount: total, debtAmount: debt, wallet, date, note: desc };
                displayToast(`تم تحديث فاتورة ${client} بنجاح`);
            }
            editingInvoiceId = null;
        } else {
            clientTransactions.unshift({ id: Date.now(), client, amount: paid, reqAmount: total, debtAmount: debt, type: "CLIENT_INVOICE", wallet, category: "فاتورة زبون", date, time: formatCurrentTime12h(), note: desc });
            displayToast(paid > total
                ? `تم تسجيل فاتورة ${client} وإضافة رصيد موجب (+${(paid - total).toLocaleString("en-US")}) لحسابه`
                : `تم تسجيل فاتورة ${client} بنجاح`);
        }

        saveStorage();
        closeGlassModal("clientInvoiceModal");
        if (!document.getElementById("clientStatementView").classList.contains("is-hidden")) renderClientStatement();
        renderMainState();
    }

    function openClientPaymentModal(clientName) {
        editingPaymentId = null;
        document.getElementById("clientPaymentModalTitle").innerText = "قبض دفعة سداد دَين";
        document.getElementById("btnCommitClientPayment").innerText = "تأكيد سداد الدفعة وإيداعها";
        document.getElementById("payClientName").value = clientName || "";
        document.getElementById("clientSettlementAmount").value = "";
        document.getElementById("clientSettlementDate").value = formatISODate(new Date());
        document.getElementById("payNote").value = "سداد دفعة من الدَّين";
        if (paymentWallets.length > 0) document.getElementById("clientSettlementMethod").value = paymentWallets[0];
        syncWalletPickerDisplays();
        openGlassModal("clientPaymentModal");
    }

    function executeCommitClientPayment() {
        const client = (document.getElementById("payClientName").value || "").trim();
        const paid = parseNumberSafe(document.getElementById("clientSettlementAmount").value, NaN);
        const wallet = document.getElementById("clientSettlementMethod").value || (paymentWallets[0] || "كاش");
        const date = document.getElementById("clientSettlementDate").value || formatISODate(new Date());
        const note = (document.getElementById("payNote").value || "").trim() || "سداد دفعة نقدية";

        if (isNaN(paid) || paid <= 0) { displayToast("يرجى إدخال مبلغ صحيح للدفعة أكبر من صفر", true); return; }

        registerNewClientIfMissing(client);

        if (editingPaymentId != null) {
            const idx = clientTransactions.findIndex(t => t.id == editingPaymentId);
            if (idx !== -1) {
                clientTransactions[idx] = { ...clientTransactions[idx], client, amount: paid, wallet, date, note };
                displayToast(`تم تحديث دفعة ${client} بنجاح`);
            }
            editingPaymentId = null;
        } else {
            clientTransactions.unshift({ id: Date.now(), client, amount: paid, reqAmount: 0, debtAmount: 0, isPayment: true, type: "CLIENT_PAYMENT", wallet, category: "سداد ديون", date, time: formatCurrentTime12h(), note });
            displayToast(`تم استلام دفعة ${paid} من ${client}`);
        }

        saveStorage();
        closeGlassModal("clientPaymentModal");
        if (!document.getElementById("clientStatementView").classList.contains("is-hidden")) renderClientStatement();
        renderMainState();
    }

    function confirmDeleteTx(id) {
        promptConfirmDialog("حذف الحركة", "هل تريد بالتأكيد حذف هذه الحركة؟", () => {
            allTransactions = allTransactions.filter(t => t.id != id);
            clientTransactions = clientTransactions.filter(t => t.id != id);
            saveStorage();
            displayToast("تم حذف الحركة");
            renderMainState();
            if (!document.getElementById("clientStatementView").classList.contains("is-hidden")) renderClientStatement();
            const catDetailModal = document.getElementById("categoryDetailModal");
            if (catDetailModal && catDetailModal.classList.contains("is-active-modal")) {
                renderCategoryDetailModalContent();
            }
        });
    }

    function requestClearAllRecords() {
        promptConfirmDialog("مسح كافة البيانات", "سيتم حذف جميع المعاملات وتصفير سجلات الزبائن بالكامل، ولن تعود عند التحديث إطلاقاً. هل تود المتابعة؟", () => {
            allTransactions = [];
            clientTransactions = [];
            archivedClients = [];
            UnifiedStorage.save("app_client_transactions_v1", []);
            customAppTitle = "";
            UnifiedStorage.save("app_custom_title_v1", "");
            updateAppTitleDisplay();
            UnifiedStorage.save("app_finances_data_v17", []);
            UnifiedStorage.save("app_archived_clients_v17", []);
            activeStatementClient = null;
            editingRecordId = null;
            selectedHistoryCategory = null;
            selectedHistoryWallet = "ALL";
            updateClientsDatalist();
            closeGlassModal("settingsModal");
            navigateToHomeView();
            pushCloudSync();
            displayToast("تم مسح كافة البيانات وتصفير الحسابات بنجاح");
        });
    }

    let pendingConfirmRequiresDeletePwd = false;

    function promptConfirmDialog(title, msg, callback, requireDeletePwd = true, confirmLabel = "تأكيد الحذف") {
        document.getElementById("confirmBoxHeader").innerText = title;
        document.getElementById("confirmBoxMessage").innerText = msg;
        const approveBtn = document.getElementById("confirmApprovedBtn");
        if (approveBtn) approveBtn.innerText = confirmLabel || "تأكيد الحذف";
        pendingConfirmCallback = callback;
        pendingConfirmRequiresDeletePwd = Boolean(requireDeletePwd && deletePassword);

        const pwdBox = document.getElementById("confirmDeletePwdBox");
        const pwdInp = document.getElementById("confirmDeletePwdInput");
        const pwdErr = document.getElementById("confirmDeletePwdErr");
        if (pwdBox) pwdBox.style.display = pendingConfirmRequiresDeletePwd ? "block" : "none";
        if (pwdInp) pwdInp.value = "";
        if (pwdErr) pwdErr.style.display = "none";

        openGlassModal("confirmAlertModal");
        if (pendingConfirmRequiresDeletePwd && pwdInp) {
            setTimeout(() => pwdInp.focus(), 80);
        }
    }

    function runApprovedAction() {
        if (pendingConfirmRequiresDeletePwd && deletePassword) {
            const pwdInp = document.getElementById("confirmDeletePwdInput");
            const pwdErr = document.getElementById("confirmDeletePwdErr");
            const entered = pwdInp ? pwdInp.value : "";
            if (entered !== deletePassword) {
                if (pwdErr) pwdErr.style.display = "block";
                displayToast("كلمة مرور الحذف غير صحيحة!", true);
                if (pwdInp) pwdInp.focus();
                return;
            }
        }
        const cb = pendingConfirmCallback;
        pendingConfirmCallback = null;
        pendingConfirmRequiresDeletePwd = false;
        closeGlassModal("confirmAlertModal");
        if (typeof cb === "function") cb();
    }

    function syncActiveModalViewportHeight() {
        const vh = (window.visualViewport && window.visualViewport.height) ? window.visualViewport.height : window.innerHeight;
        const maxH = Math.max(220, Math.floor(vh - 24)) + "px";
        document.querySelectorAll(".glass-modal-backdrop.is-active-modal .glass-modal-sheet, .glass-modal-backdrop.is-active-modal .confirm-dialog-wrapper").forEach(el => {
            el.style.maxHeight = maxH;
        });
    }

    if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => {
            syncActiveModalViewportHeight();
            const activeEl = document.activeElement;
            if (activeEl && activeEl.closest && activeEl.closest(".glass-modal-sheet")) {
                setTimeout(() => {
                    try { activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch(e) {}
                }, 60);
            }
        });
    }

    document.addEventListener("focusin", (e) => {
        const el = e.target;
        if (el && el.closest && el.closest(".glass-modal-sheet") && (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA")) {
            setTimeout(() => {
                syncActiveModalViewportHeight();
                try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch(err) {}
            }, 120);
        }
    });

    function openGlassModal(id) {
        const el = document.getElementById(id);
        if (!el) return;
        const alreadyOpen = el.classList.contains("is-active-modal");
        el.classList.add("is-active-modal");
        if (!alreadyOpen && id !== "exitAppConfirmModal") {
            openModalOrderStack = openModalOrderStack.filter(mId => mId !== id);
            openModalOrderStack.push(id);
            if (!isNavigatingViaPopstate) {
                pushAppHistoryStep("modal_" + id);
            }
        }
        el.style.zIndex = String(200 + Math.max(1, openModalOrderStack.length) * 10);
        syncActiveModalViewportHeight();
    }
    function closeGlassModal(id) {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove("is-active-modal");
            el.style.zIndex = "";
        }
        openModalOrderStack = openModalOrderStack.filter(mId => mId !== id);
        if (id === "addTxModalSheet") closeCategoryDropdown();
        if (id === "clientInvoiceModal") closeClientDropdown();
        closeAllActionMenus();
    }

    document.addEventListener("click", function(e) {
        const backdrop = e.target;
        if (
            backdrop &&
            backdrop.classList &&
            backdrop.classList.contains("glass-modal-backdrop") &&
            backdrop.classList.contains("is-active-modal") &&
            backdrop.id !== "exitAppConfirmModal" &&
            backdrop.id !== "appLockScreenOverlay"
        ) {
            closeGlassModal(backdrop.id);
        }
    });

    function exportDataJSON() {
        try {
            const customerAvatarsObj = {};
            customerAvatarsCache.forEach((dataUrl, key) => {
                if (key && dataUrl) customerAvatarsObj[key] = dataUrl;
            });
            const dataToExport = {
                appTitle: customAppTitle,
                transactions: allTransactions,
                clientTransactions: clientTransactions,
                wallets: paymentWallets,
                expenseCategories: savedExpenseCategories,
                incomeCategories: savedIncomeCategories,
                clients: savedClients,
                archived: archivedClients,
                customerAvatars: customerAvatarsObj,
                exportDate: formatISODate(new Date())
            };
            const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json;charset=utf-8;" });
            const dl = document.createElement("a");
            dl.href = URL.createObjectURL(blob);
            dl.download = `نسخة_احتياطية_${formatISODate(new Date())}.json`;
            dl.click();
            setTimeout(() => URL.revokeObjectURL(dl.href), 5000);
            displayToast("تم تصدير نسخة JSON بنجاح");
        } catch(e) { displayToast("فشل التصدير", true); }
    }

    function importDataJSON(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const parsed = JSON.parse(evt.target.result);
                if (Array.isArray(parsed)) {
                    allTransactions = parsed;
                } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.transactions)) {
                    allTransactions = parsed.transactions;
                    if (Array.isArray(parsed.clientTransactions)) clientTransactions = parsed.clientTransactions;
                    migrateClientTransactionsIfNeeded();
                    if (parsed.appTitle !== undefined) {
                        customAppTitle = parsed.appTitle;
                        UnifiedStorage.save("app_custom_title_v1", customAppTitle);
                        updateAppTitleDisplay();
                    }
                    if (Array.isArray(parsed.wallets)) paymentWallets = normalizeWalletList(parsed.wallets);
                    if (Array.isArray(parsed.expenseCategories)) savedExpenseCategories = parsed.expenseCategories;
                    if (Array.isArray(parsed.incomeCategories)) savedIncomeCategories = parsed.incomeCategories;
                    if (Array.isArray(parsed.categories)) {
                        savedExpenseCategories = parsed.categories.filter(c => !["راتب العمل", "مبيعات", "خدمات زبائن", "إيراد إضافي", "أرباح تجارة", "مبيعات زبائن", "سداد ديون"].includes(c));
                        savedIncomeCategories = parsed.categories.filter(c => ["راتب العمل", "مبيعات", "خدمات زبائن", "إيراد إضافي", "أرباح تجارة", "مبيعات زبائن", "سداد ديون"].includes(c));
                    }
                    if (Array.isArray(parsed.clients)) savedClients = parsed.clients;
                    if (Array.isArray(parsed.archived)) archivedClients = parsed.archived;
                    if (parsed.customerAvatars && typeof parsed.customerAvatars === "object") {
                        const entries = Object.entries(parsed.customerAvatars).filter(([k, v]) => k && typeof v === "string" && v.startsWith("data:image/"));
                        if (entries.length > 0) {
                            entries.forEach(([k, v]) => customerAvatarsCache.set(normalizeAvatarClientKey(k), v));
                            openAvatarDB().then(db => {
                                const tx = db.transaction(AVATAR_STORE_NAME, "readwrite");
                                const store = tx.objectStore(AVATAR_STORE_NAME);
                                entries.forEach(([k, v]) => {
                                    store.put({ key: normalizeAvatarClientKey(k), dataUrl: v, updatedAt: Date.now() });
                                });
                            }).catch(() => {});
                        }
                    }
                    saveWalletsStorage();
                    saveExpenseCategoriesStorage();
                    saveIncomeCategoriesStorage();
                    saveClientsStorage();
                    saveArchivedStorage();
                } else {
                    throw new Error("تنسيق غير مدعوم");
                }
                saveStorage();
                renderDynamicWalletsUI();
                renderCategoriesDatalistAndChips();
                renderMainState();
                closeGlassModal("settingsModal");
                displayToast("تم استيراد البيانات بنجاح");
            } catch(err) { displayToast("ملف غير صالح", true); }
        };
        reader.readAsText(file);
        e.target.value = "";
    }

    let calcCurrent = "0", calcPrevious = null, calcOperator = null, calcResetNext = false, calcExprText = "";
    let calcTargetSection = null;

    function openCalculatorModal(targetSection = null) {
        calcTargetSection = targetSection;
        calcCurrent = "0"; calcPrevious = null; calcOperator = null; calcResetNext = false; calcExprText = "";
        const applyBtn = document.getElementById("calcApplyTxBtn");
        if (applyBtn) {
            if (targetSection === "customer") {
                applyBtn.innerText = "اعتماد في فاتورة زبون";
                applyBtn.style.background = "var(--accent-primary)";
            } else if (targetSection === "expense") {
                applyBtn.innerText = "اعتماد في مصروف";
                applyBtn.style.background = "var(--neon-red)";
            } else if (targetSection === "income") {
                applyBtn.innerText = "اعتماد في دخل";
                applyBtn.style.background = "var(--neon-green)";
            } else {
                applyBtn.innerText = "اعتماد الرقم في البطاقة";
                applyBtn.style.background = "var(--accent-primary)";
            }
        }
        updateCalcDisplay();
        openGlassModal("calculatorModal");
    }
    function closeCalculatorModal() { closeGlassModal("calculatorModal"); }
    function updateCalcDisplay() {
        const mainEl = document.getElementById("calcDisplayMain");
        const exprEl = document.getElementById("calcDisplayExpr");
        if (mainEl) mainEl.innerText = calcCurrent;
        if (exprEl) exprEl.innerHTML = calcExprText || "&nbsp;";
    }
    function calcInput(key) {
        if (key >= '0' && key <= '9') {
            if (calcCurrent === "0" || calcResetNext) { calcCurrent = key; calcResetNext = false; }
            else if (calcCurrent.length < 12) calcCurrent += key;
        } else if (key === '.') {
            if (calcResetNext) { calcCurrent = "0."; calcResetNext = false; }
            else if (!calcCurrent.includes('.')) calcCurrent += '.';
        } else if (key === '+/-') {
            if (calcCurrent !== "0") calcCurrent = calcCurrent.startsWith('-') ? calcCurrent.slice(1) : '-' + calcCurrent;
        } else if (key === '%') {
            calcCurrent = String(Number((parseFloat(calcCurrent) / 100).toFixed(6)));
        } else if (key === 'BACK') {
            if (!calcResetNext && calcCurrent.length > 0) {
                calcCurrent = calcCurrent.slice(0, -1);
                if (calcCurrent === "" || calcCurrent === "-") calcCurrent = "0";
            }
        } else if (key === 'C') {
            calcCurrent = "0"; calcPrevious = null; calcOperator = null; calcResetNext = false; calcExprText = "";
        } else if (['+', '-', '*', '/'].includes(key)) {
            const sym = key === '*' ? '×' : (key === '/' ? '÷' : key);
            if (calcResetNext) {
                if (!calcExprText || calcExprText.trim().endsWith('=')) {
                    calcPrevious = parseFloat(calcCurrent) || 0;
                    calcExprText = `${calcPrevious} ${sym}`;
                } else {
                    calcExprText = calcExprText.replace(/[+\-×÷]\s*$/, sym);
                }
            } else {
                const enteredVal = calcCurrent;
                if (calcOperator && calcPrevious !== null) {
                    calcCompute();
                } else {
                    calcPrevious = parseFloat(enteredVal) || 0;
                }
                calcExprText = calcExprText ? `${calcExprText} ${enteredVal} ${sym}` : `${enteredVal} ${sym}`;
            }
            calcOperator = key;
            calcResetNext = true;
        } else if (key === '=') {
            if (calcOperator && calcPrevious !== null) {
                const enteredVal = calcCurrent;
                calcExprText = `${calcExprText} ${enteredVal} =`;
                calcCompute();
                calcOperator = null; calcPrevious = null; calcResetNext = true;
            }
        }
        updateCalcDisplay();
    }
    function calcCompute() {
        const p = calcPrevious !== null ? calcPrevious : 0;
        const c = parseFloat(calcCurrent) || 0;
        let r = 0;
        if (calcOperator === '+') r = p + c;
        else if (calcOperator === '-') r = p - c;
        else if (calcOperator === '*') r = p * c;
        else if (calcOperator === '/') r = c !== 0 ? p / c : 0;
        calcCurrent = String(Number(r.toFixed(6)));
        calcPrevious = r;
    }
    function applyCalcResult() {
        if (calcOperator && calcPrevious !== null && !calcResetNext) {
            calcCompute();
            calcOperator = null;
            calcPrevious = null;
            calcResetNext = true;
        }
        const val = Math.abs(parseFloat(calcCurrent) || 0);
        const target = calcTargetSection;
        closeCalculatorModal();

        if (target === "customer") {
            openClientInvoiceModal();
            const el = document.getElementById("invTotalAmount");
            if (el && val > 0) {
                el.value = formatNumberWithCommas(val);
                recalcInvoiceDebtPreview();
            }
            return;
        }
        if (target === "expense") {
            openAddTransactionModal("EXPENSE");
            const amtInp = document.getElementById("inputTxAmount");
            if (amtInp && val > 0) amtInp.value = formatNumberWithCommas(val);
            return;
        }
        if (target === "income") {
            openAddTransactionModal("INCOME");
            const amtInp = document.getElementById("inputTxAmount");
            if (amtInp && val > 0) amtInp.value = formatNumberWithCommas(val);
            return;
        }

        if (val > 0) {
            const invModal = document.getElementById("clientInvoiceModal");
            const payModal = document.getElementById("clientPaymentModal");
            const txModal = document.getElementById("addTxModalSheet");

            if (invModal && invModal.classList.contains("is-active-modal")) {
                const el = document.getElementById("invTotalAmount");
                if (el) { el.value = formatNumberWithCommas(val); recalcInvoiceDebtPreview(); }
            } else if (payModal && payModal.classList.contains("is-active-modal")) {
                const el = document.getElementById("clientSettlementAmount");
                if (el) el.value = formatNumberWithCommas(val);
            } else {
                if (!txModal || !txModal.classList.contains("is-active-modal")) openAddTransactionModal();
                const amtInp = document.getElementById("inputTxAmount");
                if (amtInp) amtInp.value = formatNumberWithCommas(val);
            }
        }
    }

    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            const activeModals = document.querySelectorAll(".glass-modal-backdrop.is-active-modal");
            if (activeModals.length > 0) {
                activeModals.forEach(m => m.classList.remove("is-active-modal"));
                closeCategoryDropdown();
                closeClientDropdown();
                closeAllActionMenus();
                return;
            }
        }
        const calcModal = document.getElementById("calculatorModal");
        if (calcModal && calcModal.classList.contains("is-active-modal")) {
            if ((e.key >= '0' && e.key <= '9') || e.key === '.') { calcInput(e.key); e.preventDefault(); }
            else if (['+', '-', '*', '/'].includes(e.key)) { calcInput(e.key); e.preventDefault(); }
            else if (e.key === 'Enter' || e.key === '=') { calcInput('='); e.preventDefault(); }
            else if (e.key === 'Backspace') { calcInput('BACK'); e.preventDefault(); }
            else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') { calcInput('C'); e.preventDefault(); }
        }
    });


    let appLockPassword = "";
    let deletePassword = "";
    let isAppUnlockedThisSession = false;
    let pendingSecurityVerifyTarget = null;
    let pendingSecurityVerifyAction = null;

    function checkAppLockOnStartup() {
        const overlay = document.getElementById("appLockScreenOverlay");
        if (!overlay) return;
        if (appLockPassword && !isAppUnlockedThisSession) {
            overlay.classList.add("is-locked");
            const inp = document.getElementById("appLockUnlockInput");
            const err = document.getElementById("appLockErrorMsg");
            if (err) err.style.display = "none";
            if (inp) { inp.value = ""; setTimeout(() => inp.focus(), 100); }
        } else {
            overlay.classList.remove("is-locked");
        }
    }

    function attemptUnlockApp() {
        const inp = document.getElementById("appLockUnlockInput");
        const err = document.getElementById("appLockErrorMsg");
        const entered = inp ? inp.value : "";
        if (entered === appLockPassword) {
            isAppUnlockedThisSession = true;
            if (err) err.style.display = "none";
            if (inp) inp.value = "";
            document.getElementById("appLockScreenOverlay").classList.remove("is-locked");
            displayToast("تم فتح البرنامج بنجاح");
        } else {
            if (err) err.style.display = "block";
            if (inp) { inp.value = ""; inp.focus(); }
        }
    }

    function renderSecuritySettingsUI() {
        const appBadge = document.getElementById("appLockStatusBadge");
        const appDis = document.getElementById("appLockDisabledControls");
        const appEn = document.getElementById("appLockEnabledControls");
        const hasAppLock = Boolean(appLockPassword);
        if (appBadge) {
            appBadge.innerText = hasAppLock ? "مفعّلة" : "غير مفعّلة";
            appBadge.className = `security-status-badge ${hasAppLock ? "is-enabled" : "is-disabled"}`;
        }
        if (appDis) appDis.style.display = hasAppLock ? "none" : "flex";
        if (appEn) appEn.style.display = hasAppLock ? "flex" : "none";

        const delBadge = document.getElementById("deletePwdStatusBadge");
        const delDis = document.getElementById("deletePwdDisabledControls");
        const delEn = document.getElementById("deletePwdEnabledControls");
        const hasDelPwd = Boolean(deletePassword);
        if (delBadge) {
            delBadge.innerText = hasDelPwd ? "مفعّلة" : "غير مفعّلة";
            delBadge.className = `security-status-badge ${hasDelPwd ? "is-enabled" : "is-disabled"}`;
        }
        if (delDis) delDis.style.display = hasDelPwd ? "none" : "flex";
        if (delEn) delEn.style.display = hasDelPwd ? "flex" : "none";
    }

    function enableSecurityPassword(target) {
        const inpId = target === "appLock" ? "newAppLockPwdInput" : "newDeletePwdInput";
        const inp = document.getElementById(inpId);
        const val = (inp ? inp.value : "").trim();
        if (!val) {
            displayToast("يرجى إدخال كلمة المرور أولاً", true);
            if (inp) inp.focus();
            return;
        }
        if (target === "appLock") {
            appLockPassword = val;
            isAppUnlockedThisSession = true;
            UnifiedStorage.save("app_lock_password_v1", appLockPassword);
            displayToast("تم تفعيل قفل الدخول للبرنامج");
        } else {
            deletePassword = val;
            UnifiedStorage.save("delete_password_v1", deletePassword);
            displayToast("تم تفعيل حماية عمليات الحذف");
        }
        if (inp) inp.value = "";
        renderSecuritySettingsUI();
        pushCloudSync();
    }

    function openSecurityActionPrompt(target, action) {
        pendingSecurityVerifyTarget = target;
        pendingSecurityVerifyAction = action;
        const titleEl = document.getElementById("secVerifyModalTitle");
        const curInp = document.getElementById("secVerifyCurrentInput");
        const newGrp = document.getElementById("secVerifyNewGroup");
        const newInp = document.getElementById("secVerifyNewInput");
        const errEl = document.getElementById("secVerifyErrorMsg");
        const btnEl = document.getElementById("secVerifyConfirmBtn");

        const targetLabel = target === "appLock" ? "قفل الدخول" : "حماية الحذف";
        if (titleEl) titleEl.innerText = action === "change" ? `تغيير كلمة مرور ${targetLabel}` : `إلغاء ${targetLabel}`;
        if (newGrp) newGrp.style.display = action === "change" ? "flex" : "none";
        if (curInp) curInp.value = "";
        if (newInp) newInp.value = "";
        if (errEl) errEl.style.display = "none";
        if (btnEl) {
            btnEl.innerText = action === "change" ? "حفظ كلمة المرور الجديدة" : "تأكيد إلغاء الحماية";
            btnEl.style.background = action === "change" ? "linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)" : "linear-gradient(135deg, #EF4444 0%, #DC2626 100%)";
        }
        openGlassModal("securityVerifyModal");
        if (curInp) setTimeout(() => curInp.focus(), 80);
    }

    function submitSecurityVerifyAction() {
        const curInp = document.getElementById("secVerifyCurrentInput");
        const newInp = document.getElementById("secVerifyNewInput");
        const errEl = document.getElementById("secVerifyErrorMsg");
        const enteredCur = curInp ? curInp.value : "";
        const actualCur = pendingSecurityVerifyTarget === "appLock" ? appLockPassword : deletePassword;

        if (enteredCur !== actualCur) {
            if (errEl) {
                errEl.innerText = "كلمة المرور الحالية غير صحيحة!";
                errEl.style.display = "block";
            }
            displayToast("كلمة المرور الحالية غير صحيحة!", true);
            if (curInp) curInp.focus();
            return;
        }

        if (pendingSecurityVerifyAction === "change") {
            const newVal = (newInp ? newInp.value : "").trim();
            if (!newVal) {
                if (errEl) {
                    errEl.innerText = "يرجى إدخال كلمة المرور الجديدة!";
                    errEl.style.display = "block";
                }
                if (newInp) newInp.focus();
                return;
            }
            if (pendingSecurityVerifyTarget === "appLock") {
                appLockPassword = newVal;
                isAppUnlockedThisSession = true;
                UnifiedStorage.save("app_lock_password_v1", appLockPassword);
            } else {
                deletePassword = newVal;
                UnifiedStorage.save("delete_password_v1", deletePassword);
            }
            displayToast("تم تغيير كلمة المرور بنجاح");
        } else {
            if (pendingSecurityVerifyTarget === "appLock") {
                appLockPassword = "";
                UnifiedStorage.save("app_lock_password_v1", "");
            } else {
                deletePassword = "";
                UnifiedStorage.save("delete_password_v1", "");
            }
            displayToast("تم إلغاء الحماية بنجاح");
        }

        closeGlassModal("securityVerifyModal");
        renderSecuritySettingsUI();
        pushCloudSync();
    }


    // =========================================================================
    // تهيئة تطبيق الويب التقدمي (PWA) المستقل (Manifest + Service Worker + Install)
    // =========================================================================
    let deferredPwaPrompt = null;

    function setupSingleFilePWA() {
        // 1. تسجيل عامل الخدمة الحقيقي (sw.js) للعمل الكامل دون إنترنت
        if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1")) {
            navigator.serviceWorker.register("./sw.js").catch(() => {});
        }

        // 3. إظهار زر التثبيت الذكي لـ Android / Chrome أو تلميح iOS
        const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        if (!isStandalone && isIOSDevice) {
            setPwaInstallButtonsVisible(true);
        }

        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            deferredPwaPrompt = e;
            if (!isStandalone) setPwaInstallButtonsVisible(true);
        });

        window.addEventListener("appinstalled", () => {
            deferredPwaPrompt = null;
            setPwaInstallButtonsVisible(false);
            displayToast("تم تثبيت التطبيق على جهازك بنجاح");
        });
    }

    function setPwaInstallButtonsVisible(show) {
        const headerBtn = document.getElementById("pwaInstallHeaderBtn");
        const sideBtn = document.getElementById("pwaInstallSidebarBtn");
        if (headerBtn) headerBtn.classList.toggle("is-visible", show);
        if (sideBtn) sideBtn.classList.toggle("is-visible", show);
    }

    function triggerPwaInstall() {
        const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        if (deferredPwaPrompt) {
            deferredPwaPrompt.prompt();
            deferredPwaPrompt.userChoice.then((choice) => {
                if (choice && choice.outcome === "accepted") {
                    setPwaInstallButtonsVisible(false);
                }
                deferredPwaPrompt = null;
            }).catch(() => {});
        } else if (isIOSDevice) {
            openGlassModal("iosInstallHintModal");
        }
    }

    const AVATAR_DB_NAME = "cashmate_local_avatars_db";
    const AVATAR_STORE_NAME = "avatars";
    const customerAvatarsCache = new Map();
    let pendingAvatarUploadClient = "";

    function normalizeAvatarClientKey(name) {
        return String(name || "").trim().replace(/\s+/g, " ").toLowerCase();
    }

    function openAvatarDB() {
        return new Promise((resolve, reject) => {
            if (!window.indexedDB) {
                reject(new Error("IndexedDB unavailable"));
                return;
            }
            const req = window.indexedDB.open(AVATAR_DB_NAME, 1);
            req.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(AVATAR_STORE_NAME)) {
                    db.createObjectStore(AVATAR_STORE_NAME, { keyPath: "key" });
                }
            };
            req.onsuccess = function(e) { resolve(e.target.result); };
            req.onerror = function() { reject(req.error || new Error("IndexedDB open failed")); };
        });
    }

    function preloadAllCustomerAvatars() {
        openAvatarDB().then(db => {
            const tx = db.transaction(AVATAR_STORE_NAME, "readonly");
            const store = tx.objectStore(AVATAR_STORE_NAME);
            const req = store.getAll();
            req.onsuccess = function() {
                const rows = Array.isArray(req.result) ? req.result : [];
                rows.forEach(item => {
                    if (item && item.key && item.dataUrl) {
                        customerAvatarsCache.set(item.key, item.dataUrl);
                    }
                });
                if (rows.length > 0) refreshAllCustomerAvatarViews();
            };
        }).catch(() => {});
    }

    function getCachedCustomerAvatar(clientName) {
        const key = normalizeAvatarClientKey(clientName);
        if (!key) return "";
        return customerAvatarsCache.get(key) || "";
    }

    function saveCustomerAvatarToDB(clientName, dataUrl) {
        const key = normalizeAvatarClientKey(clientName);
        if (!key || !dataUrl) return Promise.resolve();
        customerAvatarsCache.set(key, dataUrl);
        refreshAllCustomerAvatarViews();
        return openAvatarDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(AVATAR_STORE_NAME, "readwrite");
            tx.objectStore(AVATAR_STORE_NAME).put({ key, dataUrl, updatedAt: Date.now() });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    function deleteCustomerAvatarFromDB(clientName) {
        const key = normalizeAvatarClientKey(clientName);
        if (!key) return Promise.resolve();
        customerAvatarsCache.delete(key);
        refreshAllCustomerAvatarViews();
        return openAvatarDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction(AVATAR_STORE_NAME, "readwrite");
            tx.objectStore(AVATAR_STORE_NAME).delete(key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    function compressAvatarImageFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = function(evt) {
                const img = new Image();
                img.onload = function() {
                    const maxDim = 250;
                    const srcW = img.naturalWidth || img.width;
                    const srcH = img.naturalHeight || img.height;
                    const side = Math.min(srcW, srcH);
                    const sx = Math.max(0, Math.floor((srcW - side) / 2));
                    const sy = Math.max(0, Math.floor((srcH - side) / 2));
                    const outSize = Math.min(maxDim, side);

                    const canvas = document.createElement("canvas");
                    canvas.width = outSize;
                    canvas.height = outSize;
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, outSize, outSize);

                    let dataUrl = canvas.toDataURL("image/webp", 0.7);
                    if (!dataUrl || !dataUrl.startsWith("data:image/webp")) {
                        dataUrl = canvas.toDataURL("image/jpeg", 0.7);
                    }
                    resolve(dataUrl);
                };
                img.onerror = () => reject(new Error("Invalid image"));
                img.src = evt.target.result;
            };
            reader.onerror = () => reject(new Error("File read error"));
            reader.readAsDataURL(file);
        });
    }

    function getInvoiceAvatarClientName() {
        const inp = document.getElementById("invClientName");
        return inp ? inp.value.trim() : "";
    }

    function renderAvatarWidgetState(imgId, placeholderId, clientName) {
        const imgEl = document.getElementById(imgId);
        const phEl = document.getElementById(placeholderId);
        if (!imgEl || !phEl) return;

        const dataUrl = getCachedCustomerAvatar(clientName);
        if (dataUrl) {
            imgEl.src = dataUrl;
            imgEl.style.display = "block";
            phEl.style.display = "none";
        } else {
            imgEl.removeAttribute("src");
            imgEl.style.display = "none";
            phEl.style.display = "inline-flex";
        }
    }

    function updateInvoiceModalAvatarPreview() {
        renderAvatarWidgetState(
            "invoiceModalAvatarImg",
            "invoiceModalAvatarPlaceholder",
            getInvoiceAvatarClientName()
        );
    }

    function updateStatementAvatarPreview(clientName) {
        renderAvatarWidgetState(
            "statementClientAvatarImg",
            "statementClientAvatarPlaceholder",
            clientName || activeStatementClient || ""
        );
    }

    function closeCustomerAvatarMenus() {
        document.querySelectorAll(".client-avatar-popover.is-open").forEach(el => {
            el.classList.remove("is-open");
        });
    }

    function handleCustomerAvatarClick(event, clientName, menuId) {
        if (event) event.stopPropagation();
        const cleanName = String(clientName || "").trim();
        if (!cleanName) {
            closeCustomerAvatarMenus();
            displayToast("يرجى كتابة أو اختيار اسم الزبون أولاً", true);
            return;
        }
        const existingUrl = getCachedCustomerAvatar(cleanName);
        if (!existingUrl) {
            closeCustomerAvatarMenus();
            triggerCustomerAvatarUpload(cleanName);
            return;
        }
        const menu = document.getElementById(menuId);
        if (!menu) return;
        const wasOpen = menu.classList.contains("is-open");
        closeCustomerAvatarMenus();
        if (!wasOpen) {
            menu.classList.add("is-open");
        }
    }

    document.addEventListener("click", function(e) {
        if (!e.target.closest || !e.target.closest(".client-avatar-anchor")) {
            closeCustomerAvatarMenus();
        }
    });

    function refreshAllCustomerAvatarViews() {
        updateInvoiceModalAvatarPreview();
        if (activeStatementClient) updateStatementAvatarPreview(activeStatementClient);
        renderMainState();
    }

    function shareClientStatementWhatsApp() {
        if (!activeStatementClient) return;
        const appName = (customAppTitle || "").trim() || "إدارة الأموال والمصاريف";
        const metrics = computeClientLedger(activeStatementClient);
        const todayStr = formatISODate(new Date());
        const fmt = (n) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });

        const balanceLine = metrics.credit > 0
            ? `✅ *رصيد موجب (للزبون):* +${fmt(metrics.credit)}`
            : `⚠️ *الدين المتبقي:* ${fmt(metrics.debt)}`;

        const recentTx = clientTransactions
            .filter(t => t.client === activeStatementClient)
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        let lines = [
            `📊 *كشف حساب زبون - ${appName}*`,
            `👤 *الزبون:* ${activeStatementClient}`,
            `📅 *التاريخ:* ${todayStr}`,
            `───────────────`,
            `💰 *المطلوب الكلي:* ${fmt(metrics.req)}`,
            `💵 *المدفوع:* ${fmt(metrics.paid)}`,
            balanceLine
        ];

        if (recentTx.length > 0) {
            lines.push(`───────────────`);
            lines.push(`🧾 *آخر الحركات:*`);
            recentTx.forEach(t => {
                const kind = t.isPayment ? "سند قبض" : "فاتورة";
                const noteTxt = t.note ? ` (${t.note})` : "";
                lines.push(`• ${t.date || ""} | ${kind}: ${fmt(t.amount)}${noteTxt}`);
            });
        }

        const text = lines.join("\n");
        const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(waUrl, "_blank", "noopener,noreferrer");
    }

    function triggerCustomerAvatarUpload(clientName) {
        const cleanName = String(clientName || "").trim();
        if (!cleanName) {
            displayToast("يرجى كتابة أو اختيار اسم الزبون أولاً", true);
            return;
        }
        pendingAvatarUploadClient = cleanName;
        const inp = document.getElementById("customerAvatarFileInput");
        if (inp) {
            inp.value = "";
            inp.click();
        }
    }

    function handleCustomerAvatarFileSelected(event) {
        const file = event && event.target && event.target.files ? event.target.files[0] : null;
        if (!file) return;
        const targetClient = pendingAvatarUploadClient || getInvoiceAvatarClientName() || activeStatementClient || "";
        if (!targetClient) return;

        compressAvatarImageFile(file)
            .then(dataUrl => saveCustomerAvatarToDB(targetClient, dataUrl))
            .then(() => {
                displayToast("تم حفظ صورة الزبون محلياً على جهازك");
            })
            .catch(() => {
                displayToast("تعذر معالجة الصورة المحددة", true);
            });
        event.target.value = "";
    }

    function confirmDeleteCustomerAvatar(clientName) {
        const cleanName = String(clientName || "").trim();
        if (!cleanName || !getCachedCustomerAvatar(cleanName)) return;
        promptConfirmDialog(
            "حذف صورة الزبون",
            `هل أنت متأكد من حذف صورة الزبون "${cleanName}"؟`,
            () => {
                deleteCustomerAvatarFromDB(cleanName)
                    .then(() => displayToast("تم حذف صورة الزبون"))
                    .catch(() => displayToast("تعذر حذف الصورة", true));
            },
            true,
            "تأكيد الحذف"
        );
    }

    setupSingleFilePWA();
    window.onload = initApplication;
