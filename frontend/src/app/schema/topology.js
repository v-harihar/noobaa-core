const server = {
    type: 'object',
    required: [
        'hostname',
        'secret',
        'mode',
        'version',
        'addresses',
        'timezone',
        'locationTag',
        'storage',
        'memory',
        'cpus',
        'time',
        'dns',
        'phonehome',
        'clusterConnectivity',
        'debugMode',
        'isMaster'
    ],
    properties: {
        secret: {
            type: 'string'
        },
        hostname: {
            type: 'string'
        },
        mode: {
            type: 'string',
            enum: [
                'CONNECTED',
                'DISCONNECTED',
                'IN_PROGRESS'
            ]
        },
        version: {
            type: 'string'
        },
        addresses: {
            type: 'array',
            items: {
                type: 'string'
            }
        },
        timezone: {
            type: 'string'
        },
        locationTag: {
            type: 'string'
        },
        storage: {
            $ref: '#/def/common/storage'
        },
        memory: {
            type: 'object',
            required: [
                'total',
                'used'
            ],
            properties: {
                total: {
                    type: 'number'
                },
                used: {
                    type: 'number'
                }
            }
        },
        cpus: {
            type: 'object',
            required: [
                'count',
                'usage'
            ],
            properties: {
                count: {
                    type: 'integer'
                },
                usage: {
                    type: 'number'
                }
            }
        },
        time: {
            type: 'integer'
        },
        ntp: {
            type: 'object',
            required: [
                'server'
            ],
            properties: {
                server: {
                    type: 'string'
                },
                status: {
                    $ref: '#/def/common/serviceCheckResult'
                }
            }
        },
        dns: {
            type: 'object',
            required: [
                'servers',
                'searchDomains'
            ],
            properties: {
                nameResolution: {
                    type: 'object',
                    required: [
                        'status'
                    ],
                    properties: {
                        status: {
                            $ref: '#/def/common/serviceCheckResult'
                        }
                    }
                },
                servers: {
                    required: [
                        'list'
                    ],
                    list: {
                        type: 'array',
                        items: {
                            type: 'string'
                        }
                    },
                    status: {
                        $ref: '#/def/common/serviceCheckResult'
                    }
                },
                searchDomains: {
                    type: 'array',
                    items: {
                        type: 'string'
                    }
                }
            }
        },
        proxy: {
            type: 'object',
            required: [
                'status'
            ],
            properties: {
                status:{
                    $ref: '#/def/common/serviceCheckResult'
                }
            }
        },
        phonehome: {
            type: 'object',
            required: [
                'status',
                'lastStatusCheck'
            ],
            properties: {
                status:{
                    $ref: '#/def/common/serviceCheckResult'
                },
                lastStatusCheck: {
                    type: 'integer'
                }
            }
        },
        remoteSyslog: {
            required: [
                'status',
                'lastStatusCheck'
            ],
            status: {
                $ref: '#/def/common/serviceCheckResult'
            },
            lastStatusCheck: {
                type: 'integer'
            }
        },
        clusterConnectivity: {
            type: 'object',
            additionalProperties: {
                $ref: '#/def/common/serviceCheckResult'
            }
        },
        debugMode: {
            type: 'boolean'
        },
        isMaster: {
            type: 'boolean'
        }
    }
};

export default {
    type: 'object',
    required: [
        'servers',
        'serverMinRequirements',
        'supportHighAvailability',
        'isHighlyAvailable'
    ],
    properties: {
        servers: {
            type: 'object',
            additionalProperties: server
        },
        serverMinRequirements: {
            type: 'object',
            properties: {
                storage: {
                    type: 'integer'
                },
                memory: {
                    type: 'integer'
                },
                cpus: {
                    type: 'integer'
                }
            }
        },
        supportHighAvailability: {
            type: 'boolean'
        },
        isHighlyAvailable: {
            type: 'boolean'
        }
    }
};