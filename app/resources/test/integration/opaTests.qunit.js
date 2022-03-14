/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require(["TR/trialbalance/test/integration/AllJourneys"
	], function () {
		QUnit.start();
	});
});
