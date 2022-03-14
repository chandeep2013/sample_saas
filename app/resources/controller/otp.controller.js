sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/Token",
    "sap/ui/core/BusyIndicator",
    "TR/trialbalance/model/formatter"
],
	/**
	 * @param {typeof sap.ui.core.mvc.Controller} Controller
	 */
    function (Controller, MessageBox, Token, BusyIndicator, formatter) {
        var ledger,replaceCompanyCodeText;
        "use strict";
        //trialbalancedatamodel
        return Controller.extend("TR.trialbalance.controller.otp", {
            formatter: formatter,
            onInit: function () {
                var oOwnerComponent = this.getOwnerComponent();
			    var oRouter = oOwnerComponent.getRouter();
			    oRouter.attachRouteMatched(this.onRouteMatched, this);
                
            },
            onRouteMatched:function(){
                //////---------------------- Selection service calls ----------------------/////////
                var that = this;
                var FilterParamModel = new sap.ui.model.json.JSONModel();
                //BusyIndicator.show(-1);
                $.ajax({
                    method: "GET",
                    contentType: "application/json",
                    url: "/node/getCustomers",
                    async: true,
                    success: function (result) {
                       // LedgerResponse = result.results;
                        console.log(result);
                        
                    },
                    error: function (errorThrown) {
                        console.log(errorThrown);
                        console.log("Ledger ==> Error");
                    }
                });
                
                
            },
            onAfterRendering: function () {
                /* Set mandatory fields
                   set fromdate as month start date 
                   set todate as month end date*/
                this.getView().byId("idLedger").setMandatory(true);
                this.getView().byId("idCompanyCode").setMandatory(true);
                this.getView().byId("idPostedDateFrom").setMandatory(true);
                this.getView().byId("idPostedDateTo").setMandatory(true);
                var date = new Date();
                var firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDate();
                var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
                if (firstDay < 10) {
                    firstDay = "0" + firstDay;
                }
                this.getView().byId("fromDate").setDateValue(new Date(date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + firstDay));
                this.getView().byId("toDate").setDateValue(new Date(date.getFullYear() + "/" + (date.getMonth() + 1) + "/" + lastDay));
            },
            onLoadData:function(evt){
                /* ######################### Pagination ############################ */
                if(evt.getSource().getId() === "__bar1"){
                    loadmore = 0;
                    total = 0;
                    var trialbalancedatamodel = new sap.ui.model.json.JSONModel();
                    var otrialbalancedata = {
                        "results": []
                    };
                    trialbalancedatamodel.setData(otrialbalancedata);
                    this.getView().setModel(trialbalancedatamodel, "oModelData");
                }
                loadmore += 1;
                if(loadmore === 1){
                  var top = 10;
                  var skip = 0;
                }
                else{
                    top = 10;
                    skip = top * (loadmore-1);
                    
                }
                this.onSearch(top,skip);
            },
            onSearch: function (top,skip) {
                // get trial data from s/4 system
                var that = this;
                BusyIndicator.show(-1);
                var fromDate = that.getView().byId("fromDate").getValue();
                var ToDate = that.getView().byId("toDate").getValue();
                var companyCode = that.getView().byId("idSelectedComapnyCode").getTokens();
                var aCodeEntries = [];
                for (var i = 0; i < companyCode.length; i++) {
                    aCodeEntries.push("CompanyCode eq '" + parseInt(companyCode[i].getText()) + "'");
                }
                replaceCompanyCodeText = "( " + aCodeEntries.join(" or ") + " )";
                ledger = that.getView().byId("idSelectedLedger").getValue();
                if (fromDate === "" || ToDate === "" || aCodeEntries.length === 0 || ledger === "") {
                    MessageBox.error("Enter Mandatory Fields..!");
                    return;
                }
                //////-------------------------------------------------------------------//////
                var spath = "/sap/opu/odata/sap/C_TRIALBALANCE_CDS/C_TRIALBALANCE(P_FromPostingDate=datetime'" + fromDate + "T00:00:00',P_ToPostingDate=datetime'" + ToDate + "T00:00:00')/Results?$skip="+ skip +"&$top="+ top +"&$filter=Ledger eq '" + ledger + "' and {1} &$select=CompanyCode,GLAccount,GLAccountHierarchyName,ChartOfAccounts,StartingBalanceAmtInCoCodeCrcy,DebitAmountInCoCodeCrcy,CreditAmountInCoCodeCrcy,EndingBalanceAmtInCoCodeCrcy,CompanyCodeCurrency";
                spath = spath.replace("{1}", replaceCompanyCodeText);
                var RequestBody = {
                    "sPath":spath
                };
                // node.js service call
                var oModel = new sap.ui.model.json.JSONModel();
                $.ajax({
                    method: "POST",
                    contentType: "application/json",
                    url: "/node/getTrialBalanceData",
                    data: JSON.stringify(RequestBody),
                    async: true,
                    success: function (result) {
                        BusyIndicator.hide();
                        oModel.setData(result);
                        total+=result.results.length;
                        if(result.results.length === 0){
                            that.getView().byId("idLoadMoreButton").setVisible(false);
                        }
                        else{
                            that.getView().byId("idLoadMoreButton").setVisible(true);
                        }
                        that.getView().byId("idTrailBalanceDataCount").setText("Trial Balance Data(" + total + ")");
                        //that.getView().setModel(oModel, "oModelData");
                        var aJSONadd = oModel.getJSON();
                        var oJSONadd = JSON.parse(aJSONadd);

                        var oModelService = that.getView().getModel("oModelData"); //this model is used for table binding
                        var aJSON = oModelService.getJSON();
                        var oJSON = JSON.parse(aJSON);

                        oJSON.results = oJSON.results.concat(oJSONadd.results);
                        aJSON = JSON.stringify(oJSON);
                        oModelService.setJSON(aJSON);
                        that.getView().getModel("oModelData").refresh();
                       // that.getView().setModel(oModel, "oModelData");
                    },
                    error: function (errorThrown) {
                        BusyIndicator.hide();
                        if(errorThrown.status === 404){
                            var errormsg = "Error Not found."
                        }
                        else{
                            errormsg = errorThrown.responseJSON.message;
                        }
                        MessageBox.error(
                            errormsg + ". Please contact BTP Support!", {
                                icon: MessageBox.Icon.ERROR,
                                title: errorThrown.statusText,
                                actions: MessageBox.Action.OK,
                                onClose: function (oAction) { / * do something * / }
                            }
                        );
                        //sap.m.MessageToast.show("Error on getting data");
                    }
                });
            },
            onClear: function () {
                // clear filters
                this.getView().byId("fromDate").setValue("");
                this.getView().byId("toDate").setValue("");
                this.getView().byId("idSelectedLedger").setValue("");
                this.getView().byId("idSelectedComapnyCode").setTokens([]);
            },
            onPressSubmit: function(){
                // post data to OTP
                var that = this;
                var MasterDataCheckbox = this.getView().byId("idMasterDataCheckBox").getSelected();
                var TrialBalanceDataCheckbox = this.getView().byId("idTrialBalanceDataCheckBox").getSelected();
                if(that.getView().getModel("oModelData") === undefined){
                    MessageBox.error("No TrailBalance data applicable to send!");
                    return;
                }
                else if(TrialBalanceDataCheckbox === true && MasterDataCheckbox === true){
                    that.PushToOTP();
                    that.PushMasterDataToOTP();
                    that.stopBusy = false;
                }
                else if(MasterDataCheckbox === false && TrialBalanceDataCheckbox === true){
                    that.PushToOTP();
                    that.stopBusy = true;
                }
                else if(MasterDataCheckbox === true && TrialBalanceDataCheckbox === false){
                    that.PushMasterDataToOTP();
                    that.stopBusy = true;
                }
                else{
                    MessageBox.error("Select COA Master Data/Tiral Balance Data check box to send!");
                    return;
                }
            },
            headerInfo:function(){
                // set headers for node.js service
                var that = this;
                var filter = "Ledger eq '" + ledger + "' and {1}";
                filter = filter.replace("{1}", replaceCompanyCodeText);
                try{
                    var location = window.location.href;
                    var subdoamin = location.split(".")[0].split("//")[1];
                 }catch(err){
                     subdoamin = "";
                 }
                var reqbody={
                    "fromDate":that.getView().byId("fromDate").getValue(),
                    "ToDate":that.getView().byId("toDate").getValue(),
                    "filter":filter,
                    "select":"CompanyCode,GLAccount,GLAccountHierarchyName,ChartOfAccounts,StartingBalanceAmtInCoCodeCrcy,DebitAmountInCoCodeCrcy,CreditAmountInCoCodeCrcy,EndingBalanceAmtInCoCodeCrcy,CompanyCodeCurrency,ProfitCenter,CostCenter",
                    "format":"json",
                    "TenantID":subdoamin
                    //"MasterData":that.getView().byId("idMasterDataCheckBox").getSelected()
                };
                return reqbody;
            },
            PushToOTP: function () {
                ////################# Push Data to OTP ###############/////////////
                var that = this;
                var reqbody = this.headerInfo();
                BusyIndicator.show(-1);
                $.ajax({
                    method: "POST",
                    contentType: "application/json",
                    url: "/node/PostTrialbalanceData",
                    data: JSON.stringify(reqbody),
                    async: true,
                    success: function (result) {
                        BusyIndicator.hide();
                        if(that.getView().byId("idMasterDataCheckBox").getSelected()){
                            MessageBox.success("Trial Balance, Company Code and GL Accounts Sent Successfully!");
                        }
                        else{
                            MessageBox.success("Trial Balance Posted Successfully!");
                        }
                    },
                    error: function (errorThrown) {
                        BusyIndicator.hide();
                        //sap.m.MessageToast.show("Error on posing data");
                        if(errorThrown.status === 404){
                            var errormsg = "Error Not found."
                        }
                        else{
                            errormsg = errorThrown.responseJSON.message;
                        }
                        MessageBox.error(
                            errormsg + ". Please contact BTP Support!", {
                                icon: MessageBox.Icon.ERROR,
                                title: errorThrown.statusText,
                                actions: MessageBox.Action.OK,
                                onClose: function (oAction) { / * do something * / }
                            }
                        );
                    }
                });
            },
            PushMasterDataToOTP:function(){
                ////############################ Master Data service call #################/////////////////
                var that = this;
                var reqbody = this.headerInfo();
                if(that.stopBusy !== false){
                    BusyIndicator.show(-1);
                }
                $.ajax({
                    method: "POST",
                    contentType: "application/json",
                    url: "/node/PostCOAMasterData",
                    data: JSON.stringify(reqbody),
                    async: true,
                    success: function (result) {
                        if(that.stopBusy !== false){
                            BusyIndicator.hide();
                            MessageBox.success("Company Code and GL Accounts Sent Successfully!"); 
                        }
                    },
                    error: function (errorThrown) {
                        BusyIndicator.hide();
                        if(errorThrown.status === 404){
                            var errormsg = "Error Not found."
                        }
                        else{
                            errormsg = errorThrown.responseJSON.message;
                        }
                        MessageBox.error(
                            errormsg + ". Please contact BTP Support!", {
                                icon: MessageBox.Icon.ERROR,
                                title: errorThrown.statusText,
                                actions: MessageBox.Action.OK,
                                onClose: function (oAction) { / * do something * / }
                            }
                        );
                    }
                });
            },
            onValueHelpRequestLedger: function() {
               // var that = this; ledger f4help
                if (!this.oDialogLedger) {
                    this.oDialogLedger = sap.ui.xmlfragment("TR.trialbalance.fragments.ledgerF4Help", this);
                    this.getView().addDependent(this.oDialogLedger);
                }
                this.oDialogLedger.open();
            },
            onLedgerCancel: function() {
                // close ledger
                this.oDialogLedger.close();
            },
            onLedgerF4HelpSelect: function(evt) {
                // select ledger field
                var selectedval = sap.ui.getCore().byId("idF4HelpLedgerTable").getSelectedContextPaths()[0];
                var selectedKey = this.getView().getModel("ParamData").getProperty(selectedval);
                this.getView().byId("idSelectedLedger").setValue(selectedKey.Ledger);
                this.oDialogLedger.close();
            },
            onValueHelpRequestCompanyCode: function() {
                // companycode f4help
                //var that = this;
                if (!this.oDialogCompanyCode) {
                    this.oDialogCompanyCode = sap.ui.xmlfragment("TR.trialbalance.fragments.companyCodeF4Help", this);
                    this.getView().addDependent(this.oDialogCompanyCode);
                }
                this.oDialogCompanyCode.open();
            },
            onCompanyCodeCancel: function() {
                // close companycode
                this.oDialogCompanyCode.close();
            },
            onCompanyCodeF4HelpSelect: function(evt) {
                // select comapanycode fields
                var aSelectedItems = sap.ui.getCore().byId("idF4HelpCompanyCodeTable").getSelectedItems(),
                    oMultiInput = this.getView().byId("idSelectedComapnyCode");
                this.getView().byId("idSelectedComapnyCode").setTokens([]);
                if (aSelectedItems && aSelectedItems.length > 0) {
                    aSelectedItems.forEach(function(oItem) {
                        oMultiInput.addToken(new Token({
                            text: oItem.getCells()[0].getText()
                        }));
                    });
                }
                this.oDialogCompanyCode.close();
            },
            OnSearchComapanyCode: function() {
                // companycode filter
                //var sQuery = oEvent.getParameter("query");
                var sQuery = sap.ui.getCore().byId("idSearchCompanyCode").getValue();
                var Title = new sap.ui.model.Filter("CompanyCode", sap.ui.model.FilterOperator.Contains, sQuery);
                var Desc = new sap.ui.model.Filter("CompanyCodeName", sap.ui.model.FilterOperator.Contains, sQuery);
                var filters = new sap.ui.model.Filter([Title, Desc]);
                var listassign = sap.ui.getCore().byId("idF4HelpCompanyCodeTable");
                listassign.getBinding("items").filter(filters, "Appliation");
            }
        });
    });
