module.exports = {
    getSubscriptions: getSubscriptions ,
    createRoute: createRoute,
    deleteRoute: deleteRoute ,
    createSMInstance: createSMInstance,
    getSMInstance: getSMInstance,
    deleteSMInstance: deleteSMInstance
};

const cfenv = require('cfenv');
const appEnv = cfenv.getAppEnv();

const core = require('@sap-cloud-sdk/core');

const axios = require('axios');
const qs = require('qs');

async function getSubscriptions(registry) {
    try {
        // get access token
        let options = {
            method: 'POST',
            url: registry.url + '/oauth/token?grant_type=client_credentials&response_type=token',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(registry.clientid + ':' + registry.clientsecret).toString('base64')
            }
        };
        let res = await axios(options);
        try {
            // get subscriptions
            let options1 = {
                method: 'GET',
                url: registry.saas_registry_url + '/saas-manager/v1/application/subscriptions',
                headers: {
                    'Authorization': 'Bearer ' + res.data.access_token
                }
            };
            let res1 = await axios(options1);
            return res1.data;
        } catch (err) {
            console.log(err.stack);
            return err.message;
        }
    } catch (err) {
        console.log(err.stack);
        return err.message;
    }
};

async function getCFInfo(appname) {
    try {
        // get app GUID
        let res1 = await core.executeHttpRequest({ destinationName: 'otpsaas-cfapi'}, {
            method: 'GET',
            url: '/v3/apps?organization_guids=' + appEnv.app.organization_id + '&space_guids=' + appEnv.app.space_id + '&names=' + appname
        });
        // get domain GUID
        let res2 = await core.executeHttpRequest({ destinationName: 'otpsaas-cfapi'}, {
            method: 'GET',
            url: '/v3/domains?names=' + /\.(.*)/gm.exec(appEnv.app.application_uris[0])[1]
        });
        let results = {
            'app_id': res1.data.resources[0].guid,
            'domain_id': res2.data.resources[0].guid
        };
        return results;
    } catch (err) {
        console.log(err.stack);
        return err.message;
    }
};

async function createRoute(tenantHost, appname) {
    getCFInfo(appname).then(
        async function (CFInfo) {
            try {
                // create route
                let res1 = await core.executeHttpRequest({ destinationName: 'otpsaas-cfapi'}, {
                    method: 'POST',
                    url: '/v3/routes',
                    data: {
                        'host': tenantHost,
                        'relationships': {
                            'space': {
                                'data': {
                                    'guid': appEnv.app.space_id
                                }
                            },
                            'domain': {
                                'data': {
                                    'guid': CFInfo.domain_id
                                }
                            }
                        }
                    },
                });
                // map route to app
                let res2 = await core.executeHttpRequest({ destinationName: 'otpsaas-cfapi'}, {
                    method: 'POST',
                    url: '/v3/routes/' + res1.data.guid + '/destinations',
                    data: {
                        'destinations': [{
                            'app': {
                                'guid': CFInfo.app_id
                            }
                        }]
                    },
                });
                console.log('Route created for ' + tenantHost);
                return res2.data;
            } catch (err) {
                console.log(err.stack);
                return err.message;
            }
        },
        function (err) {
            console.log(err.stack);
            return err.message;
        });
};

async function deleteRoute(tenantHost, appname) {
    getCFInfo(appname).then(
        async function (CFInfo) {
            try {
                // get route id
                let res1 = await core.executeHttpRequest({ destinationName: 'otpsaas-cfapi'}, {
                    method: 'GET',
                    url: '/v3/apps/' + CFInfo.app_id + '/routes?hosts=' + tenantHost
                });
                if (res1.data.pagination.total_results === 1) {
                    try {
                        // delete route
                        let res2 = await core.executeHttpRequest({ destinationName: 'otpsaas-cfapi'}, {
                            method: 'DELETE',
                            url: '/v3/routes/' + res1.data.resources[0].guid
                        });
                        console.log('Route deleted for ' + tenantHost);
                        return res2.data;
                    } catch (err) {
                        console.log(err.stack);
                        return err.message;
                    }
                } else {
                    let errmsg = { 'error': 'Route not found' };
                    console.log(errmsg);
                    return errmsg;
                }
            } catch (err) {
                console.log(err.stack);
                return err.message;
            }
        },
        function (err) {
            console.log(err.stack);
            return err.message;
        });
};

async function createSMInstance(sm, tenantId) {
    try {
        // get access token
        let options = {
            method: 'POST',
            url: sm.url + '/oauth/token?grant_type=client_credentials&response_type=token',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(sm.clientid + ':' + sm.clientsecret).toString('base64')
            }
        };
        let res = await axios(options);
        try {
            // get service offering id
            let options1 = {
                method: 'GET',
                url: sm.sm_url + "/v1/service_offerings?fieldQuery=catalog_name eq 'hana'",
                headers: {
                    'Authorization': 'Bearer ' + res.data.access_token
                }
            };
            let res1 = await axios(options1);
            if (res1.data.num_items === 1) {
                try {
                    // get service plan id
                    let options2 = {
                        method: 'GET',
                        url: sm.sm_url + "/v1/service_plans?fieldQuery=catalog_name eq 'hdi-shared' and service_offering_id eq '" + res1.data.items[0].id + "'",
                        headers: {
                            'Authorization': 'Bearer ' + res.data.access_token
                        }
                    };
                    let res2 = await axios(options2);
                    if (res2.data.num_items === 1) {
                        try {
                            // create service instance
                            let options3 = {
                                method: 'POST',
                                url: sm.sm_url + '/v1/service_instances?async=false',
                                data: {
                                    'name': tenantId,
                                    'service_plan_id': res2.data.items[0].id
                                },
                                headers: {
                                    'Authorization': 'Bearer ' + res.data.access_token
                                }
                            };
                            let res3 = await axios(options3);
                            try {
                                // create service binding
                                let options4 = {
                                    method: 'POST',
                                    url: sm.sm_url + '/v1/service_bindings?async=false',
                                    data: {
                                        'name': tenantId,
                                        'service_instance_id': res3.data.id
                                    },
                                    headers: {
                                        'Authorization': 'Bearer ' + res.data.access_token
                                    }
                                };
                                let res4 = await axios(options4);
                                if (res4.data.hasOwnProperty('id') && res4.data.hasOwnProperty('credentials')) {
                                    let payload = { 'id': res4.data.id, 'credentials': res4.data.credentials, 'status': 'CREATION_SUCCEEDED' };
                                    try {
                                        // deploy DB artefacts
                                        let options5 = {
                                            method: 'POST',
                                            data: payload,
                                            url: process.env.db_api_url + '/v1/deploy/to/instance',
                                            headers: {
                                                'Authorization': 'Basic ' + Buffer.from(process.env.db_api_user + ':' + process.env.db_api_password).toString('base64'),
                                                'Content-Type': 'application/json'
                                            }
                                        };
                                        let res5 = await axios(options5);
                                        return res5.data;
                                    } catch (err) {
                                        console.log(err.stack);
                                        return err.message;
                                    }
                                } else {
                                    let errmsg = { 'error': 'Invalid service binding' };
                                    console.log(errmsg, res4);
                                    return errmsg;
                                }
                            } catch (err) {
                                console.log(err.stack);
                                return err.message;
                            }
                        } catch (err) {
                            console.log(err.stack);
                            return err.message;
                        }
                    } else {
                        let errmsg = { 'error': 'Service plan hdi-shared not found' };
                        console.log(errmsg);
                        return errmsg;
                    }
                } catch (err) {
                    console.log(err.stack);
                    return err.message;
                }
            } else {
                let errmsg = { 'error': 'Service offering hana not found' };
                console.log(errmsg);
                return errmsg;
            }
        } catch (err) {
            console.log(err.stack);
            return err.message;
        }
    } catch (err) {
        console.log(err.stack);
        return err.message;
    }
};

async function getSMInstance(sm, tenantId) {
    try {
        // get access token
        let options = {
            method: 'POST',
            url: sm.url + '/oauth/token?grant_type=client_credentials&response_type=token',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(sm.clientid + ':' + sm.clientsecret).toString('base64')
            }
        };
        let res = await axios(options);
        try {
            // get service binding details
            let options1 = {
                method: 'GET',
                url: sm.sm_url + "/v1/service_bindings?fieldQuery=name eq '" + tenantId + "'",
                headers: {
                    'Authorization': 'Bearer ' + res.data.access_token
                }
            };
            let res1 = await axios(options1);
            if (res1.data.num_items === 1) {
                return res1.data.items[0];
            } else {
                let errmsg = { 'error': 'Service binding not found for tenant ' + tenantId };
                console.log(errmsg);
                return errmsg;
            }
        } catch (err) {
            console.log(err.stack);
            return err.message;
        }
    } catch (err) {
        console.log(err.stack);
        return err.message;
    }
};

async function deleteSMInstance(sm, tenantId) {
    try {
        // get access token
        let options = {
            method: 'POST',
            url: sm.url + '/oauth/token?grant_type=client_credentials&response_type=token',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(sm.clientid + ':' + sm.clientsecret).toString('base64')
            }
        };
        let res = await axios(options);
        try {
            // get service binding and service instance ids
            let options1 = {
                method: 'GET',
                url: sm.sm_url + "/v1/service_bindings?fieldQuery=name eq '" + tenantId + "'",
                headers: {
                    'Authorization': 'Bearer ' + res.data.access_token
                }
            };
            let res1 = await axios(options1);
            if (res1.data.num_items === 1) {
                try {
                    // delete service binding
                    let options2 = {
                        method: 'DELETE',
                        url: sm.sm_url + '/v1/service_bindings/' + res1.data.items[0].id,
                        headers: {
                            'Authorization': 'Bearer ' + res.data.access_token
                        }
                    };
                    let res2 = await axios(options2);
                    try {
                        // delete service instance
                        let options3 = {
                            method: 'DELETE',
                            url: sm.sm_url + '/v1/service_instances/' + res1.data.items[0].service_instance_id,
                            headers: {
                                'Authorization': 'Bearer ' + res.data.access_token
                            }
                        };
                        let res3 = await axios(options3);
                        return res3.data;
                    } catch (err) {
                        console.log(err.stack);
                        return err.message;
                    }
                } catch (err) {
                    console.log(err.stack);
                    return err.message;
                }
            } else {
                let errmsg = { 'error': 'Service binding not found for tenant ' + tenantId };
                console.log(errmsg);
                return errmsg;
            }
        } catch (err) {
            console.log(err.stack);
            return err.message;
        }
    } catch (err) {
        console.log(err.stack);
        return err.message;
    }
};
