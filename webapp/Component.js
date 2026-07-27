/*
 ***********************************************************************
 * Change History
 * Date        Author      Change No.      Description
 * --------  -----------  --------------   -----------------------------
 *24/10/17    C5253525    #435296		  Pass the asset No and username 
 *                                         to SAP backend system.
 *12/01/18    I327900     #435296         Pass the asset No and username
 *                                          to SAP backend system.
 ***********************************************************************
 */
sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "com/csr/flp/ext/model/models",
    "com/csr/flp/ext/controller/ListSelector",
    "com/csr/flp/ext/controller/ErrorHandler",
    "sap/m/MessageToast",
    "sap/ui/core/routing/HashChanger"
], function (UIComponent, Device, models, ListSelector, ErrorHandler, MessageToast, HashChanger) {
    "use strict";
    console.log("=== CSRFLPEXTENSION COMPONENT.JS LOADED - VERSION TEST 123 ===");
    return UIComponent.extend("com.csr.flp.ext.Component", {
        metadata: {
            manifest: "json"
        },
        init: function () {
            var ieFlag;
            var that = this;
            this._bDialogOpen = false;

            //Set Standard FLP Timeout value to 24 Hrs
            //Changes made during Neo to Cloud FOundation Migration - 22/07/2027 by FAIR TEAM
            /* Remove this code as it is not required anymore. The timeout is set in a different way in Build Work ZOne with the below code or overwritten with the Work ZOne settings.
            if (sap.hana.uis.flp.SessionTimeoutHandler) {
                sap.hana.uis.flp.SessionTimeoutHandler.heliumSessionTimeout = 24 * 60 * 60 * 1000;
            }
                */

            if (window.sap && sap.hana && sap.hana.uis && sap.hana.uis.flp && sap.hana.uis.flp.SessionTimeoutHandler) {
    sap.hana.uis.flp.SessionTimeoutHandler.heliumSessionTimeout = 24 * 60 * 60 * 1000;
}
              //Changes made during Neo to Cloud FOundation Migration - 22/07/2027 by FAIR TEAM

            //Manage Home Button
            //Changes made during Neo to Cloud FOundation Migration - 22/07/2027 by FAIR TEAM
            /*sap.ui.getCore().byId("homeBtn").attachPress(function () {
                that.manageHomeBtn();
            });*/
            var oHomeBtn = sap.ui.getCore().byId("homeBtn");
    if (oHomeBtn) {
        oHomeBtn.attachPress(function () {
            that.manageHomeBtn();
        });
    }
        //Changes made during Neo to Cloud FOundation Migration - 22/07/2027 by FAIR TEAM
            //Keep Session Active
            this.getUserDetails();
            var sServiceBase = sap.ui.require.toUrl("com/csr/flp/ext"); ////Changes made during Neo to Cloud FOundation Migration - 22/07/2027 by FAIR TEAM
            var oModel = new sap.ui.model.odata.ODataModel(sServiceBase + "/sap/opu/odata/sap/ZPOSITIVE_UTILITY_SRV_SRV", true);    //Changes made during Neo to Cloud FOundation Migration - 22/07/2027 by FAIR TEAM
            this.setModel(oModel);
            // set the device model
            this.setModel(models.createDeviceModel(), "device");
            // set the FLP model
            this.setModel(models.createFLPModel(), "FLP");
            var hostName = window.location.hostname;
            if (hostName.indexOf("csr-epos-dev") !== -1) {
                this.Environment = "DEVELOPMENT";
                this.AppVersion = "v5.4";
            } else if (hostName.indexOf("csr-epos-qas") !== -1) {
                this.Environment = "TEST";
                this.AppVersion = "v5.1";
            } else {
                this.Environment = "";
                this.AppVersion = "v5.1";
            }
            //Read Pin Code
            oModel.read("/UserPasscodeSet", null, null, false,
                function (oData) {
                    //Set Idle Time
                    if (oData.results[0].TimeOut > 0) {
                        // Open the Manage Pin Code Dialog in Create Mode
                        that.idleTimeMinutes = Math.floor(oData.results[0].TimeOut / 60);
                        if (that.idleTimeMinutes === 0) {
                            that.idleTimeMinutes = 5; //Default 5 Minute
                        }
                    }
                    if (oData.results[0].FullName.length > 0) {
                        // Open the Manage Pin Code Dialog in Create Mode
                        that.FullName = oData.results[0].FullName;
                    }
                    // Check if a Pin already exists in backend
                    if (oData.results[0].HashCode.length === 0) {
                        // Open the Manage Pin Code Dialog in Create Mode
                        that.mode = "create";
                        that.openPinCodeDialog(that);
                    }
                    // Open the Manage Pin Code Dialog in Change Mode
                    else if (oData.results[0].Isvalid !== "X") {
                        that.mode = "change";
                        that.openPinCodeDialog(that);
                    }
                },
                function (oErr) {
                    //alert(error);
                }
            );
            //Create JSON Model
            var jsonModel = new sap.ui.model.json.JSONModel();
            var jsonData = {};
            //Check if Activex OBject is available
            try {
                //Begin of changes by I561959 02.08.2022 - Asset determination
                // Try DNS lookup first (works on all browsers)
                try {
                    jsonData.selectedAssetID = this.getAssetId();
                    console.log("✅ DNS Lookup (DEV): Asset detected:", jsonData.selectedAssetID);
                } catch (dnsError) {
                    // DNS lookup failed (expected on VPN or when nslookupdev.csr.com.au not accessible)
                    // Don't show error to user - silently try ActiveX fallback
                    console.warn("DNS lookup failed (possibly VPN/network issue):", dnsError.message || dnsError);

                    // Try ActiveX fallback for IE
                    try {
                        var network = new ActiveXObject("WScript.Network");
                        jsonData.selectedAssetID = network.computerName;
                        console.log("ActiveX: Asset detected:", jsonData.selectedAssetID);
                    } catch (activeXError) {
                        // ActiveX also failed (expected in Chrome/Edge)
                        // Don't show error - will fall through to outer catch for alternative detection
                        console.warn("ActiveX failed (expected in non-IE browsers):", activeXError.message || activeXError);
                        throw activeXError; // Throw to outer catch for tryAlternativeAssetDetection
                    }
                }
                //End of changes by I561959 02.08.2022 - Asset determination

                jsonData.available = true;
                jsonData.notAvailable = false;

                //Update backend with selected asset
                var oUpdatedPayload = {
                    Terminal: jsonData.selectedAssetID
                };
                var mParameters = {
                    success: function (oSuccess) {
                        console.log("Asset update successful");
                    },
                    error: function (oError) {
                        console.log("Asset update failed");
                    },
                    merge: false
                };
                oModel.update("/STOREASSETSet('" + jsonData.selectedAssetID + "')", oUpdatedPayload, mParameters);

            }
            catch (err) {
                // Both DNS and ActiveX failed - use alternative detection
                console.log("Automatic detection failed, trying alternative methods");
                that.tryAlternativeAssetDetection(jsonData);
            }
            jsonModel.setData(jsonData);
            this.setModel(jsonModel, "Asset");
            var oAssetData = {
                "DefaultAsset": jsonData.selectedAssetID
            };
            var oAssetModel = new sap.ui.model.json.JSONModel(oAssetData);
            sap.ui.getCore().setModel(oAssetModel, "AssetModel");
            // If we have a valid asset, store it in localStorage
            if (jsonData.selectedAssetID && jsonData.selectedAssetID !== "") {
                localStorage.setItem("defaultAsset", jsonData.selectedAssetID);
            }
            this.oListSelector = new ListSelector();
            this._oErrorHandler = new ErrorHandler(this);
            // call the base component's init function and create the App view
            UIComponent.prototype.init.apply(this, arguments);
            // 1. fiori renderer for reuse
            var oRenderer = sap.ushell.Container.getRenderer("fiori2");
            oRenderer.hideHeaderItem("backBtn");
            var authBtn = new sap.m.Button({
                id: "authBtn",
                icon: "sap-icon://locked",
                press: function () {
                    that.mode = "lock";
                    that.openPinCodeDialog(that);
                },
                tooltip: "Lock Screen"
            });
            var changeBtn = new sap.m.Button({
                id: "changeBtn",
                icon: "sap-icon://edit",
                press: function () {
                    that.mode = "change";
                    that.openPinCodeDialog(that);
                },
                tooltip: "Change Passcode"
            });
            oRenderer.addSubHeader("sap.m.Bar", {
                id: "extnBar",
                contentLeft: [
                    new sap.m.Label({
                        id: "enivronmentLabel",
                        text: that.Environment
                    }).addStyleClass("sapUiLargeMarginBegin"),
                    new sap.m.Label({
                        text: that.AppVersion
                    }).addStyleClass("sapUiSmallMarginBegin")
                ],
                contentMiddle: [
                    new sap.m.Label({
                        id: "welcomeLabel",
                        text: that.FullName
                    })
                ],
                contentRight: [
                    authBtn,
                    changeBtn,
                    new sap.m.Button({
                        id: "assetBtn",
                        icon: "sap-icon://laptop",
                        press: function () {
                            that.openAssetDialog(that);
                        }
                    })
                ]
            }, true, false, ["home", "app"]);
            //Check if Any other screen is locked
            //Apply Lock for the first time
            if (that.mode !== "create" && localStorage.getItem("bDialogOpen") === "true") {
                that.mode = "lock";
                that.openPinCodeDialog(that);
            }
            setInterval(function () {
                document.idleTime = document.idleTime + 1;
                if (document.idleTime >= that.idleTimeMinutes && !(that._bDialogOpen)) {
                    that.mode = "lock";
                    that.openPinCodeDialog(that);
                }
            }, 60000); // 10 seconds
            $(document).ready(function () {
                //Increment the idle time counter every minute.	
                //Zero the idle timer on mouse movement.
                $(this).mousemove(function (e) {
                    document.idleTime = 0;
                });
                $(this).keypress(function (e) {
                    document.idleTime = 0;
                });
            });
        },
        tryAlternativeAssetDetection: function (jsonData) {
            var that = this;

            // Method 1: Check localStorage for previously saved asset
            var savedAsset = localStorage.getItem("defaultAsset");
            var assetTimestamp = localStorage.getItem("assetTimestamp");

            if (savedAsset) {
                console.log("✅ Found cached asset in localStorage:", savedAsset);

                // Check if asset was saved recently (optional: could add expiration logic)
                if (assetTimestamp) {
                    var savedDate = new Date(assetTimestamp);
                    var daysSinceLastUse = (new Date() - savedDate) / (1000 * 60 * 60 * 24);
                    console.log("Asset last used:", Math.round(daysSinceLastUse), "days ago");
                }

                // Use the cached asset
                jsonData.selectedAssetID = savedAsset;
                jsonData.available = true;
                jsonData.notAvailable = false;

                var oAssetData = {
                    "DefaultAsset": savedAsset
                };
                var oAssetModel = new sap.ui.model.json.JSONModel(oAssetData);
                sap.ui.getCore().setModel(oAssetModel, "AssetModel");

                // Set the AssetIDSelect ComboBox if it exists
                var oAssetSelect = sap.ui.getCore().byId("AssetIDSelect");
                if (oAssetSelect) {
                    oAssetSelect.setSelectedKey(savedAsset);
                }

                // Update timestamp to track last use
                localStorage.setItem("assetTimestamp", new Date().toISOString());

                // Set global fallback for order application compatibility
                window.CSR_CONFIRMED_ASSET = savedAsset;
                console.log("Asset auto-selected from cache - no manual selection needed");

                return; // Asset selected, skip manual selection
            }

            // No cached asset found - need manual selection
            console.log("No cached asset found - showing manual selection dialog");
            that.fetchIPList(jsonData);
        },
        fetchIPList: function (jsonData) {
            this.getModel().read("/STOREASSETSet", null, null, false,
                function (oData) {
                    // Check if a Pin already exists in backend
                    if (oData.results.length > 0) {
                        // Open the Manage Pin Code Dialog in Change Mode
                        jsonData.available = false;
                        jsonData.notAvailable = true;
                        jsonData.AssetList = oData.results;
                    }
                },
                function (oErr) {
                    //alert(error);
                    jsonData.selectedAssetID = "";
                    jsonData.available = false;
                    jsonData.notAvailable = true;
                    jsonData.AssetList = [];
                }
            );
        },
        lockScreen: function (fThat) {
            fThat.mode = "lock";
            fThat.openPinCodeDialog(fThat);
        },
        openAuthDialog: function (fThat) {
            // create dialog lazily
            if (!fThat.oAuthDialog) {
                // create dialog via fragment factory
                fThat.oAuthDialog = sap.ui.xmlfragment("com.csr.flp.ext.fragment.Passcode");
                //Attach Press Events
                var confirmButton = sap.ui.getCore().byId("confirmBtn");
                confirmButton.attachPress(fThat.onConfirm, fThat);
                //Attach Press Events
                var cancelButton = sap.ui.getCore().byId("cancelBtn");
                cancelButton.attachPress(fThat.onCancel);
            }
            fThat.oAuthDialog.open();
        },
        openPinCodeDialog: function (fThat) {
            if (fThat.mode === "create") {
                //Create JSON Model
                var jsonModel = new sap.ui.model.json.JSONModel();
                var jsonData = {};
                jsonData.title = "Create New Passcode";
                jsonData.action = "";
                jsonData.visFlag1 = false;
                jsonData.visFlag2 = false;
                jsonData.visFlag3 = true;
                jsonData.FullName = fThat.FullName;
                jsonData.oldPasscode = "";
                jsonData.newPasscode = "";
                jsonData.confirmNewPasscode = "";
                jsonData.checkPasscode = "";
                jsonData.confirmBtnTitle = "Create";
                jsonData.cancelBtnTitle = "Cancel";
                jsonModel.setData(jsonData);
            } else if (fThat.mode === "change") {
                //Create JSON Model
                var jsonModel = new sap.ui.model.json.JSONModel();
                var jsonData = {};
                jsonData.title = "Change Passcode";
                jsonData.action = "";
                jsonData.visFlag1 = false;
                jsonData.visFlag2 = true;
                jsonData.visFlag3 = true;
                jsonData.FullName = fThat.FullName;
                jsonData.oldPasscode = "";
                jsonData.newPasscode = "";
                jsonData.confirmNewPasscode = "";
                jsonData.checkPasscode = "";
                jsonData.confirmBtnTitle = "Change";
                jsonData.cancelBtnTitle = "Cancel";
                jsonModel.setData(jsonData);
            } else if (fThat.mode === "lock") {
                //Create JSON Model
                var jsonModel = new sap.ui.model.json.JSONModel();
                var jsonData = {};
                jsonData.title = "Unlock Screen";
                jsonData.action = "";
                jsonData.visFlag1 = true;
                jsonData.visFlag2 = false;
                jsonData.visFlag3 = false;
                jsonData.FullName = fThat.FullName;
                jsonData.oldPasscode = "";
                jsonData.newPasscode = "";
                jsonData.confirmNewPasscode = "";
                jsonData.checkPasscode = "";
                jsonData.confirmBtnTitle = "Unlock";
                jsonData.cancelBtnTitle = "Cancel";
                jsonModel.setData(jsonData);
            }
            // create dialog lazily
            if (!fThat.oAuthDialog && !fThat._bDialogOpen) {
                // create dialog via fragment factory
                if ((sap.ui.Device.system.phone || sap.ui.Device.system.tablet) && !sap.ui.Device.system.desktop) {
                    fThat.oAuthDialog = sap.ui.xmlfragment("com.csr.flp.ext.fragment.ManagePinCodeTouchScreen");
                } else {
                    fThat.oAuthDialog = sap.ui.xmlfragment("com.csr.flp.ext.fragment.ManagePinCode");
                }
                //Attach Press Events
                var confirmButton = sap.ui.getCore().byId("confirmBtn");
                confirmButton.attachPress(fThat.onConfirm, fThat);
                //Attach Press Events
                var cancelButton = sap.ui.getCore().byId("cancelBtn");
                cancelButton.attachPress(fThat.onCancel);
                //Attach Live Change Event
                var checkPasscodeInput = sap.ui.getCore().byId("checkPasscode");
                checkPasscodeInput.attachLiveChange(fThat.onPasscodeLiveChange);
                checkPasscodeInput.attachSubmit(fThat.onConfirm, fThat);
                var oldPasscodeInput = sap.ui.getCore().byId("oldPasscode");
                oldPasscodeInput.attachLiveChange(fThat.onPasscodeLiveChange);
                oldPasscodeInput.attachSubmit(fThat.onConfirm, fThat);
                var newPasscodeInput = sap.ui.getCore().byId("newPasscode");
                newPasscodeInput.attachLiveChange(fThat.onPasscodeLiveChange);
                newPasscodeInput.attachSubmit(fThat.onConfirm, fThat);
                var confirmNewPasscodeInput = sap.ui.getCore().byId("confirmNewPasscode");
                confirmNewPasscodeInput.attachLiveChange(fThat.onPasscodeLiveChange);
                confirmNewPasscodeInput.attachSubmit(fThat.onConfirm, fThat);
                var oDialog = sap.ui.getCore().byId("managePinCodeDialog");
                oDialog.onsapescape = function () { }; //Disable Escape Button
            }
            if (fThat.mode === "create") {
                jQuery.sap.delayedCall(1000, fThat, function () {
                    sap.ui.getCore().byId("newPasscode").focus();
                });
            } else if (fThat.mode === "change") {
                jQuery.sap.delayedCall(1000, fThat, function () {
                    sap.ui.getCore().byId("oldPasscode").focus();
                });
            } else if (fThat.mode === "lock") {
                jQuery.sap.delayedCall(1000, fThat, function () {
                    sap.ui.getCore().byId("checkPasscode").focus();
                });
            }
            fThat.oAuthDialog.setModel(jsonModel, "json");
            fThat._bDialogOpen = true;
            fThat.oAuthDialog.open();
            localStorage.setItem("bDialogOpen", true);
            //Reset Error Flag
            var inputField = sap.ui.getCore().byId("newPasscode");
            if (inputField) {
                inputField.setValueState(sap.ui.core.ValueState.None);
                inputField.setValueStateText("");
            }
            inputField = sap.ui.getCore().byId("checkPasscode");
            if (inputField) {
                inputField.setValueState(sap.ui.core.ValueState.None);
                inputField.setValueStateText("");
            }
            inputField = sap.ui.getCore().byId("oldPass code");
            if (inputField) {
                inputField.setValueState(sap.ui.core.ValueState.None);
                inputField.setValueStateText("");
            }
            inputField = sap.ui.getCore().byId("confirmNewPasscode");
            if (inputField) {
                inputField.setValueState(sap.ui.core.ValueState.None);
                inputField.setValueStateText("");
            }
        },
        openAssetDialog: function (fThat) {
            // create dialog lazily
            if (!fThat.oAssetDialog) {
                // create dialog via fragment factory
                fThat.oAssetDialog = sap.ui.xmlfragment("com.csr.flp.ext.fragment.Asset");
                //Attach Press Events
                var confirmButton = sap.ui.getCore().byId("confirmBtn2");
                confirmButton.attachPress(fThat.onConfirmAsset);
                fThat.oAssetDialog.setModel(fThat.getModel("Asset"), "Asset");
            }
            fThat.oAssetDialog.open();
        },
        onPasscodeLiveChange: function (oEvent) {
            var field = oEvent.getSource();
            field.setValue(field.getValue().replace(/[^0-9]/g, ""));
            if (field.getValue().length > 4) {
                field.setValue(field.getValue().substring(0, 4));
            }
        },
        onConfirm: function (oEvent) {
            var that = this;
            var oModel = this.getModel();
            if (this.mode === "create") {
                var jsonModel = oEvent.getSource().getModel("json");
                var passcode = jsonModel.getProperty("/newPasscode");
                var inputField = sap.ui.getCore().byId("newPasscode");
                var confirmPasscode = jsonModel.getProperty("/confirmNewPasscode");
                var confirmInputField = sap.ui.getCore().byId("confirmNewPasscode");
                if (passcode && passcode.length !== 4) {
                    inputField.setValueState(sap.ui.core.ValueState.Error);
                    inputField.setValueStateText("Invalid Pin code");
                    inputField.focus();
                    return;
                }
                if (confirmPasscode && confirmPasscode.length !== 4) {
                    confirmInputField.setValueState(sap.ui.core.ValueState.Error);
                    confirmInputField.setValueStateText("Invalid Pin code");
                    confirmInputField.focus();
                    return;
                }
                if (passcode !== confirmPasscode) {
                    confirmInputField.setValueState(sap.ui.core.ValueState.Error);
                    confirmInputField.setValueStateText("Pin code Do not Match");
                    confirmInputField.focus();
                    return;
                }
                oModel.callFunction("CreateUserPin", "POST", { "Passcode": passcode }, null,
                    function (oData, response) {
                        MessageToast.show("Passcode Set Successfully");
                        sap.ui.getCore().byId("managePinCodeDialog").close();
                        document.idleTime = 0;
                        that._bDialogOpen = false;
                        localStorage.setItem("bDialogOpen", false);
                    },
                    function (oError) {
                        // Add error handling conditions
                    }
                );
            } else if (this.mode === "lock") {
                var jsonModel = oEvent.getSource().getModel("json");
                var passcode = jsonModel.getProperty("/checkPasscode");
                var inputField = sap.ui.getCore().byId("checkPasscode");
                if (passcode && passcode.length !== 4) {
                    inputField.setValueState(sap.ui.core.ValueState.Error);
                    inputField.setValueStateText("Invalid Pin code");
                    inputField.focus();
                    return;
                }
                oModel.callFunction("ValidateUserPin", "POST", { "Passcode": passcode }, null,
                    function (oData, response) {
                        if (oData.HashCode && oData.HashCode.length > 0) {
                            if (oData.Isvalid === "X") {
                                MessageToast.show("Passcode Verified. Screen is unlocked");
                                sap.ui.getCore().byId("managePinCodeDialog").close();
                                document.idleTime = 0;
                                that._bDialogOpen = false;
                                localStorage.setItem("bDialogOpen", false);
                            }
                        } else {
                            inputField.setValueState(sap.ui.core.ValueState.Error);
                            inputField.setValueStateText("Invalid Pin code");
                            inputField.focus();
                            return;
                        }
                    },
                    function (oError) {
                        // Add error handling conditions
                    }
                );
            } else if (this.mode === "change") {
                var jsonModel = oEvent.getSource().getModel("json");
                var oldPasscode = jsonModel.getProperty("/oldPasscode");
                var newPasscode = jsonModel.getProperty("/newPasscode");
                var inputField1 = sap.ui.getCore().byId("oldPasscode");
                var inputField2 = sap.ui.getCore().byId("newPasscode");
                var confirmPasscode = jsonModel.getProperty("/confirmNewPasscode");
                var confirmInputField = sap.ui.getCore().byId("confirmNewPasscode");
                if (oldPasscode && oldPasscode.length !== 4) {
                    inputField1.setValueState(sap.ui.core.ValueState.Error);
                    inputField1.setValueStateText("Invalid Pin code");
                    inputField1.focus();
                    return;
                }
                if (newPasscode && newPasscode.length !== 4) {
                    inputField2.setValueState(sap.ui.core.ValueState.Error);
                    inputField2.setValueStateText("Invalid Pin code");
                    inputField2.focus();
                    return;
                }
                if (confirmPasscode && confirmPasscode.length !== 4) {
                    confirmInputField.setValueState(sap.ui.core.ValueState.Error);
                    confirmInputField.setValueStateText("Invalid Pin code");
                    confirmInputField.focus();
                    return;
                }
                if (newPasscode !== confirmPasscode) {
                    confirmInputField.setValueState(sap.ui.core.ValueState.Error);
                    confirmInputField.setValueStateText("Pin code doesn't match");
                    confirmInputField.focus();
                    return;
                }
                oModel.callFunction("ChangeUserPin", "POST", { "Passcode": oldPasscode, "NewPasscode": newPasscode }, null,
                    function (oData, response) {
                        if (oData.HashCode && oData.HashCode.length > 0) {
                            if (oData.Isvalid === "X") {
                                MessageToast.show("Passcode Changed");
                                document.idleTime = 0;
                                sap.ui.getCore().byId("managePinCodeDialog").close();
                                that._bDialogOpen = false;
                                localStorage.setItem("bDialogOpen", false);
                            } else {
                                document.idleTime = 0;
                                sap.ui.getCore().byId("managePinCodeDialog").close();
                                that._bDialogOpen = false;
                                localStorage.setItem("bDialogOpen", false);
                            }
                        } else {
                            inputField1.setValueState(sap.ui.core.ValueState.Error);
                            inputField1.setValueStateText("Invalid Pin code");
                            inputField1.focus();
                            return;
                        }
                    },
                    function (oError) {
                        // Add error handling conditions
                    }
                );
            }
        },
        manageHomeBtn: function () {
            var message = "Your changes will be lost when you leave this Page.";
            var urlParsing = sap.ushell.Container.getService("URLParsing");
            if (urlParsing) {
                var shellHash = urlParsing.getShellHash(window.location);
                if (shellHash === "order-Display") {
                    event.preventDefault();
                    var dialog = new sap.m.Dialog({
                        title: "Warning",
                        state: "Warning",
                        content: new sap.m.Text({ text: message }),
                        beginButton: new sap.m.Button({
                            text: "Leave Page",
                            type: "Default",
                            press: function () {
                                var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
                                oCrossAppNavigator.toExternal({ target: { shellHash: "#Shell-home" } });
                                dialog.close();
                            }
                        }),
                        endButton: new sap.m.Button({
                            text: "Cancel",
                            type: "Default",
                            press: function () {
                                dialog.close();
                            }
                        }),
                        afterClose: function () {
                            dialog.destroy();
                        }
                    });
                    dialog.open();
                }
            }
        },
        onCancel: function (oEvent) {
            oEvent.getSource().getParent().close();
            this._bDialogOpen = false;
            localStorage.setItem("bDialogOpen", false);
        },
        onConfirmAsset: function (oEvent) {
            var sServiceBase = sap.ui.require.toUrl("com/csr/flp/ext"); //Changes made during Neo to Cloud FOundation Migration - 22/07/2027 by FAIR TEAM
            var oModel = new sap.ui.model.odata.ODataModel(sServiceBase + "/sap/opu/odata/sap/ZPOSITIVE_UTILITY_SRV_SRV", true); //Changes made during Neo to Cloud FOundation Migration - 22/07/2027 by FAIR TEAM
            var sUpdatedTerminal = oEvent.getSource().getParent().getModel("Asset");
            var oData = sUpdatedTerminal.getData();
            var sUpdatedTerminalId = oData.selectedAssetID;
            if (sUpdatedTerminalId) {
                var sPoslane = "";
                if (oData.AssetList) {
                    for (var i = 0; i < oData.AssetList.length; i++) {
                        if (sUpdatedTerminalId === oData.AssetList[i].Terminal) {
                            sPoslane = oData.AssetList[i].Poslane;
                        }
                    }
                }
                var oUpdatedPayload = {
                    Poslane: sPoslane,
                    Terminal: sUpdatedTerminalId
                };
                var mParameters = {
                    success: function (oSuccess) {
                        console.log("Asset update successful!");
                    },
                    error: function (oError) {
                        console.log("Asset update failed");
                    },
                    merge: false
                };
                oModel.update("/STOREASSETSet('" + sUpdatedTerminalId + "')", oUpdatedPayload, mParameters);
                var oAssetData = {
                    "DefaultAsset": sUpdatedTerminalId
                };
                var oAssetModel = new sap.ui.model.json.JSONModel(oAssetData);
                sap.ui.getCore().setModel(oAssetModel, "AssetModel");
                localStorage.setItem("defaultAsset", sUpdatedTerminalId);
                localStorage.setItem("assetTimestamp", new Date().toISOString());
                console.log("✅ Asset saved to localStorage for future sessions");
                window.CSR_CONFIRMED_ASSET = sUpdatedTerminalId;
                if (sUpdatedTerminal) {
                    sUpdatedTerminal.setProperty("/selectedAssetID", sUpdatedTerminalId);
                    sUpdatedTerminal.setProperty("/available", true);
                    sUpdatedTerminal.setProperty("/notAvailable", false);
                }
                var oAssetSelect = sap.ui.getCore().byId("AssetIDSelect");
                if (oAssetSelect) {
                    oAssetSelect.setSelectedKey(sUpdatedTerminalId);
                    console.log("Force-updated AssetIDSelect to: " + sUpdatedTerminalId);
                }
                console.log("Asset confirmed and synchronized: " + sUpdatedTerminalId);
                console.log("Emergency fallback set: window.CSR_CONFIRMED_ASSET = " + sUpdatedTerminalId);
                oEvent.getSource().getParent().close();
            }
        },
        onCancelAsset: function (oEvent) {
            oEvent.getSource().getParent().close();
        },
        destroy: function () {
            this.oListSelector.destroy();
            this._oErrorHandler.destroy();
            UIComponent.prototype.destroy.apply(this, arguments);
        },
        getContentDensityClass: function () {
            if (this._sContentDensityClass === undefined) {
                if (jQuery(document.body).hasClass("sapUiSizeCozy") || jQuery(document.body).hasClass("sapUiSizeCompact")) {
                    this._sContentDensityClass = "";
                } else if (!Device.support.touch) {
                    this._sContentDensityClass = "sapUiSizeCompact";
                } else {
                    this._sContentDensityClass = "sapUiSizeCozy";
                }
            }
            return this._sContentDensityClass;
        },
        /*
        getUserDetails: function () {
            setInterval(function () {
                var userModel = new sap.ui.model.json.JSONModel(sap.ushell.Container.getService("UserInfo"));
                sap.ui.getCore().setModel(userModel, "userapi");
            }, 60000); // 1 minutes
        },*/
        //Changed during Neo to Cloud Foundry migration - 22/07/2026 by FAIR

        getUserDetails: function () {
    setInterval(function () {
        var oUserInfo = sap.ushell.Container.getService("UserInfo");
        var oUserData = {
            id: oUserInfo.getId(),
            firstname: oUserInfo.getFirstName(),
            lastname: oUserInfo.getLastName(),
            fullname: oUserInfo.getFullName(),
            email: oUserInfo.getEmail()
        };
        var userModel = new sap.ui.model.json.JSONModel(oUserData);
        sap.ui.getCore().setModel(userModel, "userapi");
    }, 60000); // 1 minute
},
 //Changed during Neo to Cloud Foundry migration - 22/07/2026 by FAIR
        getAssetId: function () {
            var componentData = this.getComponentData && this.getComponentData();
            var assetURL = componentData && componentData.config && componentData.config.assetURL;
            var asset;

            console.log("DNS Lookup URL:", assetURL);  // Debug log

            if (assetURL) {
                var response = $.ajax({
                    type: "GET",
                    url: assetURL,  // Should be: https://nslookupdev.csr.com.au/NsLookupService.asmx/GetDNSLookup
                    async: false
                });
                if (response && response.status === 200) {
                    asset = response.responseText;
                }
            }
            if (asset) {
                asset = asset.toUpperCase().split(".")[0];
            } else {
                throw "No Asset";
            }
            return asset;
        }
    });
});