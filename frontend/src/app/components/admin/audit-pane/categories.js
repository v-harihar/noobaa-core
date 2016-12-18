export default {
    node: {
        displayName: 'Nodes',
        events: {
            create: {
                message: 'Node Added',
                entityId: ({ node }) => node && node.name
            },

            test_node: {
                message: 'Node Tested',
                entityId: ({ node }) => node && node.name
            },

            decommission: {
                message: 'Node Deactivated',
                entityId: ({ node }) => node && node.name
            },

            recommission: {
                message: 'Node Reactivated',
                entityId: ({ node }) => node && node.name
            }
        }
    },

    obj: {
        displayName: 'Objects',
        events: {
            uploaded: {
                message: 'Upload Completed',
                entityId: ({ obj }) => obj && obj.key
            },
            deleted: {
                message: 'Object Deleted',
                entityId: ({ obj }) => obj && obj.key
            }
        }
    },

    bucket: {
        displayName: 'Buckets',
        events: {
            create: {
                message: 'Bucket Created',
                entityId: ({ bucket }) => bucket && bucket.name
            },

            delete: {
                message: 'Bucket Deleted',
                entityId: ({ bucket }) => bucket && bucket.name
            },

            set_cloud_sync: {
                message: 'Bucket Cloud Sync Set',
                entityId: ({ bucket }) => bucket && bucket.name
            },

            update_cloud_sync: {
                message: 'Bucket Cloud Sync Updated',
                entityId: ({ bucket }) => bucket && bucket.name
            },

            remove_cloud_sync: {
                message: 'Bucket Cloud Sync Removed',
                entityId: ({ bucket }) => bucket && bucket.name
            },

            edit_policy: {
                message: 'Bucket Edit Policy',
                entityId: ({ bucket }) => bucket && bucket.name
            },

            s3_access_updated: {
                message: 'Bucket S3 Access Updated',
                entityId: ({ bucket }) => bucket && bucket.name
            },

            set_lifecycle_configuration_rules: {
                message: 'Set Lifecycle Configuration',
                entityId: ({ bucket }) => bucket && bucket.name
            },

            delete_lifecycle_configuration_rules: {
                message: 'Delete Lifecycle Configuration',
                entityId: ({ bucket }) => bucket && bucket.name
            }
        }
    },

    account: {
        displayName: 'Accounts',
        events: {
            create: {
                message: 'Account Created',
                entityId: ({ account }) => account && account.email
            },

            update: {
                message: 'Account Updated',
                entityId: ({ account }) => account && account.email
            },

            delete: {
                message: 'Account Deleted',
                entityId: ({ account }) => account && account.email
            },

            s3_access_updated: {
                message: 'Account S3 Access Updated',
                entityId: ({ account }) => account && account.email
            },

            generate_credentials: {
                message: 'Account Credentials Generated',
                entityId: ({ account }) => account && account.email
            }
        }
    },

    resource: {
        displayName: 'Resources',
        events: {
            create: {
                message: 'Pool Created',
                entityId: ({ pool }) => pool && pool.name
            },

            delete: {
                message: 'Pool Deleted',
                entityId: ({ pool }) => pool && pool.name
            },

            cloud_create: {
                message: 'Cloud Resource Created',
                entityId: ({ pool }) => pool && pool.name
            },

            cloud_delete: {
                message: 'Cloud Resource Deleted',
                entityId: ({ pool }) => pool && pool.name
            },

            assign_nodes: {
                message: 'Pool Nodes Assigned',
                entityId: ({ pool }) => pool && pool.name
            }
        }
    },

    dbg: {
        displayName: 'Debug',
        events: {
            set_debug_node: {
                message: 'Node\'s Debug Mode Change',
                entityId: ({ node }) => node && node.name
            },

            diagnose_node: {
                message: 'Node Diagnose',
                entityId: ({ node }) => node && node.name
            },

            diagnose_system: {
                message: 'System Diagnose',
                entityId: () => ''
            }
        }
    },

    conf: {
        displayName: 'Configuration',
        events: {
            create_system: {
                message: 'System Created',
                entityId: () => ''
            },

            server_date_time_updated: {
                message: 'Server Date And Time Updated',
                entityId: () => ''
            },

            dns_address: {
                message: 'Set/Edit DNS Address',
                entityId: () => ''
            }
        }
    }
};
