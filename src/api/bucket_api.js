'use strict';

/**
 *
 * BUCKET API
 *
 * client (currently web client) talking to the web server to work on bucket
 *
 */
module.exports = {

    id: 'bucket_api',

    methods: {

        create_bucket: {
            method: 'POST',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                    tiering: {
                        type: 'string',
                    }
                }
            },
            reply: {
                $ref: '#/definitions/bucket_info'
            },
            auth: {
                system: 'admin'
            }
        },

        read_bucket: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                }
            },
            reply: {
                $ref: '#/definitions/bucket_info'
            },
            auth: {
                system: 'admin'
            }
        },

        update_bucket: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                    new_name: {
                        type: 'string',
                    },
                    tiering: {
                        type: 'string',
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        delete_bucket: {
            method: 'DELETE',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                }
            },
            auth: {
                system: 'admin'
            }
        },

        list_buckets: {
            method: 'GET',
            reply: {
                type: 'object',
                required: ['buckets'],
                properties: {
                    buckets: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['name'],
                            properties: {
                                name: {
                                    type: 'string'
                                },
                            }
                        }
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        list_bucket_access_accounts: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                }
            },
            reply: {
                type: 'array',
                items: {
                    $ref: 'account_api#/definitions/account_info'
                }
            },
            auth: {
                system: 'admin'
            }
        },

        get_cloud_sync_policy: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                }
            },
            reply: {
                type: 'object',
                // required: [],
                properties: {
                    name: {
                        type: 'string',
                    },
                    policy: {
                        $ref: '#/definitions/cloud_sync'
                    },
                    health: {
                        type: 'boolean'
                    },
                    status: {
                        $ref: '#/definitions/api_cloud_sync_status'
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        get_all_cloud_sync_policies: {
            method: 'GET',
            reply: {
                type: 'array',
                // required: [],
                items: {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string',
                        },
                        policy: {
                            $ref: '#/definitions/cloud_sync'
                        },
                        health: {
                            type: 'boolean'
                        },
                        status: {
                            $ref: '#/definitions/api_cloud_sync_status'
                        }
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        delete_cloud_sync: {
            method: 'DELETE',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    },
                }
            },
            auth: {
                system: 'admin'
            }
        },

        set_cloud_sync: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name', 'policy'],
                properties: {
                    name: {
                        type: 'string',
                    },
                    policy: {
                        $ref: '#/definitions/cloud_sync'
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        generate_bucket_access: {
            method: 'PUT',
            params: {
                type: 'object',
                required: ['name'],
                properties: {
                    name: {
                        type: 'string',
                    }
                }
            },
            reply: {
                type: 'object',
                required: ['access_key', 'secret_key'],
                properties: {
                    access_key: {
                        type: 'string',
                    },
                    secret_key: {
                        type: 'string',
                    }
                }
            },
            auth: {
                system: 'admin'
            }
        },

        get_cloud_buckets: {
            method: 'GET',
            params: {
                type: 'object',
                required: ['access_key', 'secret_key'],
                properties: {
                    endpoint: {
                        type: 'string',
                    },
                    access_key: {
                        type: 'string',
                    },
                    secret_key: {
                        type: 'string',
                    },
                }
            },
            reply: {
                type: 'array',
                items: {
                    type: 'string'
                }
            },
            auth: {
                system: 'admin'
            }
        }

    },

    definitions: {

        bucket_info: {
            type: 'object',
            required: ['name', 'tiering', 'storage', 'num_objects'],
            properties: {
                name: {
                    type: 'string',
                },
                tiering: {
                    $ref: 'tiering_policy_api#/definitions/tiering_policy'
                },
                storage: {
                    $ref: 'common_api#/definitions/storage_info'
                },
                num_objects: {
                    type: 'integer'
                },
                access_keys: {
                    $ref: 'system_api#/definitions/access_keys'
                },
                cloud_sync_status: {
                    $ref: '#/definitions/api_cloud_sync_status'
                }
            }
        },

        cloud_sync: {
            type: 'object',
            required: ['endpoint', 'access_keys', 'schedule'],
            properties: {
                endpoint: {
                    type: 'string',
                },
                target_bucket: {
                    type: 'string',
                },
                access_keys: {
                    type: 'array',
                    items: {
                        $ref: 'system_api#/definitions/access_keys'
                    }
                },
                schedule: {
                    type: 'integer'
                },
                last_sync: {
                    format: 'idate'
                },
                paused: {
                    type: 'boolean',
                },
                c2n_enabled: {
                    type: 'boolean',
                },
                n2c_enabled: {
                    type: 'boolean',
                },
                additions_only: { //If true, only additions will be synced
                    type: 'boolean',
                }
            }
        },

        api_cloud_sync_status: {
            enum: ['UNSYNCED', 'SYNCING', 'PASUED', 'UNABLE', 'SYNCED', 'NOTSET'],
            type: 'string',
        },

        sync_status_enum: {
            enum: ['IDLE', 'SYNCING'],
            type: 'string',
        },

    },

};
