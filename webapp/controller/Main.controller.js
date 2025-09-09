sap.ui.define([
    "com/syswise/wm/mbsp/commonlibs/lib/controller/BaseController",
    "sap/ui/events/KeyCodes"
],
    /**
     * @param {typeof sap.ui.core.mvc.Controller} Controller
     */
    function (Controller, KeyCodes) {
        "use strict";

        return Controller.extend("com.syswise.wm.mbsp.insertsputaway.controller.Main", {
            onInit: function () {
                Controller.prototype.onInit.apply(this, arguments);

                const oRouter = this.getOwnerComponent().getRouter();
                oRouter.getRoute("RouteMain").attachPatternMatched(this.onObjectMatched, this);
            },

            onObjectMatched: async function (oEvent) {
                const oComponent = this.getOwnerComponent();
                const oComponentData = oComponent.getComponentData();
                const oStartupParameters = oComponentData.startupParameters;

                this._sWarehouseNumber = oStartupParameters.WarehouseNumber && oStartupParameters.WarehouseNumber[0];
                this._sPlant = oStartupParameters.Plant && oStartupParameters.Plant[0];
                this._sStorageLocation = oStartupParameters.StorageLocation && oStartupParameters.StorageLocation[0];

                const oModel = this.getModel();

                await oModel.metadataLoaded();

                const oPlantText = this.byId("Plant_Text");
                const sPlantPath = oModel.createKey("/C_Plantvaluehelp",
                    {
                        Plant: this._sPlant
                    });
                oPlantText.unbindElement();
                oPlantText.bindElement(sPlantPath);

                const oStorageLocationText = this.byId("StorageLocation_Text");
                const sStorageLocationPath = oModel.createKey("/I_StorageLocation",
                    {
                        Plant: this._sPlant,
                        StorageLocation: this._sStorageLocation
                    });
                oStorageLocationText.unbindElement();
                oStorageLocationText.bindElement(sStorageLocationPath);

                const oBarcodeInput = this.byId("Barcode_Input");
                this.focus(oBarcodeInput);
            },

            onKeyPressed: async function (oKeyEvent) {

                switch (oKeyEvent.keyCode) {

                    case KeyCodes.F1: // F1 - Clear
                        oKeyEvent.preventDefault();

                        const bIsMessageViewOpen = await this.isMessageViewOpen();
                        if (bIsMessageViewOpen) {
                            this.closeMessageView();
                        }
                        else {
                            const oPromptModel = this.getModel("prompt_data");
                            const oScannedBarcodes = oPromptModel.getProperty("/ScannedBarcodes");
                            if (oScannedBarcodes && oScannedBarcodes.length > 0) {
                                this.onPressClear();
                            }
                            else {
                                window.history.go(-1);
                            }
                        }

                        break;

                    case KeyCodes.F3: // F3 - Post
                        oKeyEvent.preventDefault();

                        this.onPressPost();

                        break;

                }
            },

            onBarcodeChange: async function (oEvent) {
                const oPromptModel = this.getModel("prompt_data");
                const sBarcode = oPromptModel.getProperty("/Barcode");
                if (sBarcode) {

                    const oMessageManager = sap.ui.getCore().getMessageManager();
                    oMessageManager.removeAllMessages();

                    this.setBusy(true);

                    const oDeferred = $.Deferred();
                    const oPromise = oDeferred.promise();

                    const sStorageBin = oPromptModel.getProperty("/StorageBin") || "";
                    const oScannedBarcodes = oPromptModel.getProperty("/ScannedBarcodes") || [];

                    const oModel = this.getModel();
                    oModel.callFunction("/act_scan_barcode",
                        {
                            method: "POST",
                            urlParameters: {
                                Plant: this._sPlant,
                                StorageLocation: this._sStorageLocation,
                                StorageBin: sStorageBin,
                                ScannedBarcodes: JSON.stringify(oScannedBarcodes),
                                Barcode: sBarcode
                            },
                            success: function (oData, oResponse) {
                                oDeferred.resolve(oData.act_scan_barcode);
                            },
                            error: function (oError) {
                                oDeferred.resolve();
                            }
                        });

                    const oReturn = await oPromise;

                    this.setBusy(false);

                    if (!this.hasErrors()) {
                        const oScannedBarcodesNew = JSON.parse(oReturn.ScannedBarcodes);
                        oPromptModel.setProperty("/ScannedBarcodes", oScannedBarcodesNew);
                        oPromptModel.setProperty("/StorageBin", oReturn.StorageBin);
                    }

                    this.showMessages(function () {
                        const oBarcodeInput = this.byId("Barcode_Input");
                        this.focus(oBarcodeInput);
                    }.bind(this));

                    oPromptModel.setProperty("/Barcode", null);

                }
            },

            onStorageBinChange: async function (oEvent) {
                const oPromptModel = this.getModel("prompt_data");
                const sStorageBin = oPromptModel.getProperty("/StorageBin");
                if (sStorageBin) {
                    const oMessageManager = sap.ui.getCore().getMessageManager();
                    oMessageManager.removeAllMessages();

                    this.setBusy(true);

                    const oDeferred = $.Deferred();
                    const oPromise = oDeferred.promise();

                    const oModel = this.getModel();
                    oModel.callFunction("/act_scan_storage_bin",
                        {
                            method: "POST",
                            urlParameters: {
                                Plant: this._sPlant,
                                StorageLocation: this._sStorageLocation,
                                StorageBin: sStorageBin
                            },
                            success: function (oData, oResponse) {
                                oDeferred.resolve();
                            },
                            error: function (oError) {
                                oDeferred.resolve();
                            }
                        });

                    await oPromise;

                    this.setBusy(false);

                    if (!this.hasErrors()) {

                        this.showMessages(function () {
                            const oBarcodeInput = this.byId("Barcode_Input");
                            this.focus(oBarcodeInput);
                        }.bind(this));

                    }
                    else {

                        this.showMessages(function () {
                            const oStorageBinInput = this.byId("StorageBin_Input");
                            this.focus(oStorageBinInput);
                        }.bind(this));

                        oPromptModel.setProperty("/StorageBin", null);

                    }
                }
            },

            onPressClear: async function (oEvent) {
                this.clearModel("prompt_data");

                const oBarcodeInput = this.byId("Barcode_Input");
                this.focus(oBarcodeInput);
            },

            onPressPost: async function (oEvent) {

                const oPromptModel = this.getModel("prompt_data");
                const sStorageBin = oPromptModel.getProperty("/StorageBin") || "";
                const oScannedBarcodes = oPromptModel.getProperty("/ScannedBarcodes") || [];

                if
                    (
                    sStorageBin
                    &&
                    (oScannedBarcodes && oScannedBarcodes.length > 0)
                ) {
                    this.setBusy(true);

                    const oMessageManager = sap.ui.getCore().getMessageManager();
                    oMessageManager.removeAllMessages();

                    const oDeferred = $.Deferred();
                    const oPromise = oDeferred.promise();

                    const oModel = this.getModel();
                    oModel.callFunction("/act_post",
                        {
                            method: "POST",
                            urlParameters: {
                                Plant: this._sPlant,
                                StorageLocation: this._sStorageLocation,
                                StorageBin: sStorageBin,
                                ScannedBarcodes: JSON.stringify(oScannedBarcodes)
                            },
                            success: function (oData, oResponse) {
                                oDeferred.resolve();
                            },
                            error: function (oError) {
                                oDeferred.resolve();
                            }
                        });

                    await oPromise;

                    this.setBusy(false);

                    if (!this.hasErrors()) {
                        this.onPressClear();

                        this.showMessages(function () {
                            const oBarcodeInput = this.byId("Barcode_Input");
                            this.focus(oBarcodeInput);
                        }.bind(this));
                    }
                    else {
                        this.showMessages();
                    }
                }

            }

        });
    });
