    // =========================================================================
    // الربط السحابي عبر Firebase Firestore وعزل الأجهزة (Device ID Isolation)
    // =========================================================================
    const firebaseConfig = {
        apiKey: "AIzaSyA6kt-gmzaP48O9UrMgftscepK9tIzpG9Q",
        authDomain: "my-gemini-site-2026.firebaseapp.com",
        projectId: "my-gemini-site-2026",
        storageBucket: "my-gemini-site-2026.firebasestorage.app",
        messagingSenderId: "481544142251",
        appId: "1:481544142251:web:5d53ec7cd5a4d17b4b26ee"
    };

    let firestoreDb = null;
    let currentDeviceId = null;
    let unsubscribeFirestoreSnapshot = null;
    let isApplyingCloudSnapshot = false;
    let lastLocalWriteTs = 0;

    function getOriginalDeviceId() {
        let orig = "";
        try { orig = (localStorage.getItem("cashmate_original_device_id") || "").trim(); } catch(e) {}
        return orig;
    }

    function updateReturnToOriginalDeviceButton() {
        const btn = document.getElementById("returnOriginalDeviceBtn");
        if (!btn) return;
        const origId = getOriginalDeviceId();
        const activeId = currentDeviceId || "";
        if (origId && activeId && activeId !== origId) {
            btn.innerText = `العودة لجهازي الأصلي (${origId})`;
            btn.style.display = "inline-flex";
        } else {
            btn.style.display = "none";
        }
    }

    function getOrCreateDeviceId() {
        let id = "";
        try { id = (localStorage.getItem("cashmate_device_id") || "").trim(); } catch(e) {}
        if (!id) {
            const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            let code = "";
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            id = "DEV-" + code;
            try { localStorage.setItem("cashmate_device_id", id); } catch(e) {}
        }
        if (!getOriginalDeviceId()) {
            try { localStorage.setItem("cashmate_original_device_id", id); } catch(e) {}
        }
        currentDeviceId = id;
        const disp = document.getElementById("settingsCurrentDeviceId");
        if (disp) disp.innerText = id;
        updateReturnToOriginalDeviceButton();
        return id;
    }

    function updateCloudSyncBadge(isOnline, customLabel = null) {
        const badge = document.getElementById("cloudSyncStatusBadge");
        if (!badge) return;
        if (isOnline && navigator.onLine !== false) {
            badge.className = "cloud-sync-status-pill is-online";
            badge.innerText = customLabel || "متصل بالسحابة";
        } else {
            badge.className = "cloud-sync-status-pill is-local";
            badge.innerText = customLabel || "حفظ محلي";
        }
    }

    function buildCloudPayload() {
        return {
            deviceId: currentDeviceId,
            appTitle: customAppTitle || "",
            transactions: allTransactions,
            clientTransactions: clientTransactions,
            wallets: paymentWallets,
            expenseCategories: savedExpenseCategories,
            incomeCategories: savedIncomeCategories,
            clients: savedClients,
            archivedClients: archivedClients,
            appLockPassword: appLockPassword || "",
            deletePassword: deletePassword || "",
            updatedAt: Date.now()
        };
    }

    function applyCloudPayload(data) {
        if (!data || typeof data !== "object") return;
        isApplyingCloudSnapshot = true;
        try {
            if (Array.isArray(data.transactions)) allTransactions = data.transactions;
            if (Array.isArray(data.clientTransactions)) clientTransactions = data.clientTransactions;
            if (Array.isArray(data.wallets) && data.wallets.length > 0) paymentWallets = normalizeWalletList(data.wallets);
            if (Array.isArray(data.expenseCategories) && data.expenseCategories.length > 0) savedExpenseCategories = data.expenseCategories;
            if (Array.isArray(data.incomeCategories) && data.incomeCategories.length > 0) savedIncomeCategories = data.incomeCategories;
            if (Array.isArray(data.clients)) savedClients = data.clients;
            if (Array.isArray(data.archivedClients)) archivedClients = data.archivedClients;
            if (data.appTitle !== undefined) customAppTitle = data.appTitle || "";
            if (data.appLockPassword !== undefined) appLockPassword = data.appLockPassword || "";
            if (data.deletePassword !== undefined) deletePassword = data.deletePassword || "";

            migrateClientTransactionsIfNeeded();
            persistAllDataOnly();
            updateAppTitleDisplay();
            renderDynamicWalletsUI();
            renderCategoriesDatalistAndChips();
            updateClientsDatalist();
            renderMainState();
            const stmtView = document.getElementById("clientStatementView");
            if (stmtView && !stmtView.classList.contains("is-hidden")) {
                renderClientStatement();
            }
        } finally {
            isApplyingCloudSnapshot = false;
        }
    }

    function pushCloudSync() {
        if (!firestoreDb || !currentDeviceId || isApplyingCloudSnapshot) return;
        try {
            lastLocalWriteTs = Date.now();
            const payload = buildCloudPayload();
            payload.updatedAt = lastLocalWriteTs;
            firestoreDb.collection("cashmate_devices").doc(currentDeviceId)
                .set(payload, { merge: true })
                .then(() => {
                    updateCloudSyncBadge(true, "متصل ومزامن");
                })
                .catch(() => {
                    updateCloudSyncBadge(false, "حفظ محلي");
                });
        } catch(e) {
            updateCloudSyncBadge(false, "حفظ محلي");
        }
    }

    function attachDeviceRealtimeListener(deviceId) {
        if (!firestoreDb || !deviceId) return;
        if (typeof unsubscribeFirestoreSnapshot === "function") {
            try { unsubscribeFirestoreSnapshot(); } catch(e) {}
            unsubscribeFirestoreSnapshot = null;
        }
        const docRef = firestoreDb.collection("cashmate_devices").doc(deviceId);
        unsubscribeFirestoreSnapshot = docRef.onSnapshot((docSnap) => {
            if (!docSnap.exists) return;
            updateCloudSyncBadge(true, "متصل بالسحابة");
            if (docSnap.metadata && docSnap.metadata.hasPendingWrites) return;
            const data = docSnap.data();
            if (!data) return;
            if (data.updatedAt && data.updatedAt <= lastLocalWriteTs) return;
            applyCloudPayload(data);
        }, () => {
            updateCloudSyncBadge(false, "حفظ محلي");
        });
    }
    function initCloudSync() {
        const devId = getOrCreateDeviceId();
        if (typeof firebase === "undefined" || !firebase.initializeApp || !firebase.firestore) {
            updateCloudSyncBadge(false, "حفظ محلي");
            return;
        }
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            firestoreDb = firebase.firestore();
            firestoreDb.enablePersistence({ synchronizeTabs: true }).catch(() => {});

            window.addEventListener("online", () => updateCloudSyncBadge(true, "متصل بالسحابة"));
            window.addEventListener("offline", () => updateCloudSyncBadge(false, "حفظ محلي"));

            const docRef = firestoreDb.collection("cashmate_devices").doc(devId);
            docRef.get().then((docSnap) => {
                if (!docSnap.exists) {
                    const hasLocalData = allTransactions.length > 0 || clientTransactions.length > 0 || savedClients.length > 0 || Boolean(customAppTitle);
                    if (hasLocalData) {
                        pushCloudSync();
                    } else {
                        pushCloudSync();
                    }
                } else {
                    const data = docSnap.data();
                    if (data) {
                        const cloudEmpty = (!Array.isArray(data.transactions) || data.transactions.length === 0) &&
                                           (!Array.isArray(data.clientTransactions) || data.clientTransactions.length === 0);
                        const hasLocalData = allTransactions.length > 0 || clientTransactions.length > 0;
                        if (cloudEmpty && hasLocalData) {
                            pushCloudSync();
                        } else {
                            applyCloudPayload(data);
                        }
                    }
                    updateCloudSyncBadge(true, "متصل بالسحابة");
                }
                attachDeviceRealtimeListener(devId);
            }).catch(() => {
                updateCloudSyncBadge(false, "حفظ محلي");
                attachDeviceRealtimeListener(devId);
            });
        } catch(e) {
            updateCloudSyncBadge(false, "حفظ محلي");
        }
    }

    function copyDeviceIdToClipboard() {
        const code = currentDeviceId || getOrCreateDeviceId();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(code).then(() => {
                displayToast("تم نسخ كود الجهاز: " + code);
            }).catch(() => {
                displayToast("كود الجهاز: " + code);
            });
        } else {
            displayToast("كود الجهاز: " + code);
        }
    }

    function applyActiveDeviceSwitch(targetId, data) {
        currentDeviceId = targetId;
        try { localStorage.setItem("cashmate_device_id", targetId); } catch(e) {}
        const disp = document.getElementById("settingsCurrentDeviceId");
        if (disp) disp.innerText = targetId;
        updateReturnToOriginalDeviceButton();
        if (data) applyCloudPayload(data);
        attachDeviceRealtimeListener(targetId);
        updateCloudSyncBadge(true, "متصل ومزامن");
    }

    function verifySecurityPasswordThenRun(title, msg, confirmLabel, actionFn) {
        const activePwd = (typeof deletePassword === "string" && deletePassword)
            ? deletePassword
            : ((typeof appLockPassword === "string" && appLockPassword) ? appLockPassword : "");
        if (activePwd && typeof promptConfirmDialog === "function") {
            promptConfirmDialog(title, msg, actionFn, true, confirmLabel, activePwd);
        } else {
            actionFn();
        }
    }

    function linkAndRestoreDeviceId() {
        const inp = document.getElementById("linkOtherDeviceIdInput");
        const newId = (inp ? inp.value : "").trim().toUpperCase();
        if (!newId) {
            displayToast("يرجى إدخال كود الجهاز المطلوب ربطه", true);
            return;
        }
        if (!firestoreDb) {
            displayToast("تعذر الاتصال بقاعدة البيانات السحابية حالياً", true);
            return;
        }
        const performLink = () => {
            if (!getOriginalDeviceId() && currentDeviceId) {
                try { localStorage.setItem("cashmate_original_device_id", currentDeviceId); } catch(e) {}
            }
            firestoreDb.collection("cashmate_devices").doc(newId).get().then((docSnap) => {
                if (!docSnap.exists) {
                    displayToast("لم يتم العثور على بيانات لهذا الكود: " + newId, true);
                    return;
                }
                const data = docSnap.data();
                if (inp) inp.value = "";
                applyActiveDeviceSwitch(newId, data);
                displayToast("تم ربط الجهاز واستعادة البيانات بنجاح");
            }).catch(() => {
                displayToast("حدث خطأ أثناء الاتصال بالسحابة، تحقق من الإنترنت", true);
            });
        };
        verifySecurityPasswordThenRun(
            "تأكيد ربط الجهاز",
            `هل تريد ربط الجهاز بالكود ${newId} واستعادة بياناته؟`,
            "تأكيد الربط",
            performLink
        );
    }

    function returnToOriginalDeviceId() {
        const origId = getOriginalDeviceId();
        if (!origId || origId === currentDeviceId) {
            updateReturnToOriginalDeviceButton();
            return;
        }
        const performReturn = () => {
            if (!firestoreDb) {
                currentDeviceId = origId;
                try { localStorage.setItem("cashmate_device_id", origId); } catch(e) {}
                const disp = document.getElementById("settingsCurrentDeviceId");
                if (disp) disp.innerText = origId;
                updateReturnToOriginalDeviceButton();
                displayToast("تمت العودة إلى جهازك الأصلي بنجاح");
                return;
            }
            firestoreDb.collection("cashmate_devices").doc(origId).get().then((docSnap) => {
                const data = docSnap.exists ? docSnap.data() : null;
                applyActiveDeviceSwitch(origId, data);
                displayToast("تمت العودة إلى جهازك الأصلي بنجاح");
            }).catch(() => {
                applyActiveDeviceSwitch(origId, null);
                updateCloudSyncBadge(false, "حفظ محلي");
                displayToast("تمت العودة إلى جهازك الأصلي بنجاح");
            });
        };
        verifySecurityPasswordThenRun(
            "تأكيد العودة للجهاز الأصلي",
            `هل تريد العودة إلى جهازك الأصلي (${origId})؟`,
            "تأكيد العودة",
            performReturn
        );
    }
