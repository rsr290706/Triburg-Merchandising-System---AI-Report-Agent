from __future__ import annotations

from typing import TypedDict


class TableProfile(TypedDict):
    category: str
    purpose: str
    business_entity: str
    owner: str
    description: str
    primary_metrics: list[str]
    dimensions: list[str]
    common_queries: list[str]


DEFAULT_TABLE_PROFILE: TableProfile = {
    "category": "master",
    "purpose": "Business database table.",
    "business_entity": "Unknown",
    "owner": "",
    "description": "",
    "primary_metrics": [],
    "dimensions": [],
    "common_queries": [],
}


TABLE_PROFILES: dict[str, TableProfile] = {

    "orders": {
        "category": "transaction",
        "purpose": "Stores merchandising order transactions.",
        "business_entity": "Order",
        "owner": "Merchandising Team",
        "description": (
            "Central transactional table containing purchase orders, "
            "buyers, factories, merchants, shipment quantities, "
            "shipment values, inspection information and delivery details."
        ),
        "primary_metrics": [
            "oc_qty",
            "oc_value",
            "ship_qty",
            "ship_value",
        ],
        "dimensions": [
            "buyer",
            "merchant",
            "factory",
            "country",
            "style",
            "team",
            "buyerdivision",
            "qa",
        ],
        "common_queries": [
            "Shipment quantity by buyer",
            "Shipment value by buyer",
            "Shipment quantity by factory",
            "Orders by merchant",
            "Inspection status report",
            "Monthly shipment report",
            "Delayed deliveries",
            "Shipment value by country",
        ],
    },

    "buyerdivision": {
        "category": "master",
        "purpose": "Stores buyer division master data.",
        "business_entity": "Buyer Division",
        "owner": "Merchandising Team",
        "description":
            "Lookup table containing buyer divisions.",
        "primary_metrics": [],
        "dimensions": [],
        "common_queries": [
            "Buyer divisions",
            "Orders by buyer division",
        ],
    },

    "merchant": {
        "category": "master",
        "purpose": "Stores merchandiser master data.",
        "business_entity": "Merchant",
        "owner": "Merchandising Team",
        "description":
            "Reference table containing merchandiser names.",
        "primary_metrics": [],
        "dimensions": [],
        "common_queries": [
            "Orders by merchant",
            "Merchant performance",
            "Merchant workload",
        ],
    },

    "factory": {
        "category": "master",
        "purpose": "Stores factory master data.",
        "business_entity": "Factory",
        "owner": "Sourcing Team",
        "description":
            "Reference table containing manufacturing factories.",
        "primary_metrics": [],
        "dimensions": [],
        "common_queries": [
            "Factory performance",
            "Orders by factory",
            "Shipment quantity by factory",
        ],
    },

    "country": {
        "category": "master",
        "purpose": "Stores country master data.",
        "business_entity": "Country",
        "owner": "Merchandising Team",
        "description":
            "Reference table containing country names.",
        "primary_metrics": [],
        "dimensions": [],
        "common_queries": [
            "Orders by country",
            "Shipment value by country",
        ],
    },

    "qa": {
        "category": "master",
        "purpose": "Stores quality assurance staff.",
        "business_entity": "QA",
        "owner": "Quality Team",
        "description":
            "Reference table containing QA personnel.",
        "primary_metrics": [],
        "dimensions": [],
        "common_queries": [
            "Inspection status",
            "QA workload",
            "QA performance",
        ],
    },

    "style": {
        "category": "master",
        "purpose": "Stores product style information.",
        "business_entity": "Style",
        "owner": "Merchandising Team",
        "description":
            "Reference table containing style numbers, descriptions and categories.",
        "primary_metrics": [],
        "dimensions": [],
        "common_queries": [
            "Orders by style",
            "Shipment quantity by style",
        ],
    },

    "team": {
        "category": "master",
        "purpose": "Stores merchandising teams.",
        "business_entity": "Team",
        "owner": "Management",
        "description":
            "Reference table containing merchandising team names.",
        "primary_metrics": [],
        "dimensions": [],
        "common_queries": [
            "Orders by team",
            "Team performance",
        ],
    },

    "team_group": {
        "category": "master",
        "purpose": "Stores merchandising team groups.",
        "business_entity": "Team Group",
        "owner": "Management",
        "description":
            "Reference table grouping merchandising teams.",
        "primary_metrics": [],
        "dimensions": [],
        "common_queries": [
            "Orders by team group",
        ],
    },
}