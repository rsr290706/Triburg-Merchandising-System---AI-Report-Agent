from __future__ import annotations

from typing import Any, TypedDict


class ColumnProfile(TypedDict):
    meaning: str
    semantic_type: str
    description: str
    aliases: list[str]
    sql_usage: list[str]
    business_rules: list[str]
    related_columns: list[str]
    common_queries: list[str]


DEFAULT_PROFILE: ColumnProfile = {
    "meaning": "Business data column.",
    "semantic_type": "Unknown",
    "description": "",
    "aliases": [],
    "sql_usage": [],
    "business_rules": [],
    "related_columns": [],
    "common_queries": [],
}

COLUMN_PROFILES: dict[str, ColumnProfile] = {
    "buyer": {
        "meaning": "Customer purchasing the shipment.",
        "semantic_type": "Business Entity",
        "description": "Represents the customer who placed the shipment order.",
        "aliases": ["Customer", "Client", "Purchaser", "Retailer"],
        "sql_usage": ["GROUP BY", "DISTINCT", "WHERE", "ORDER BY"],
        "business_rules": [
            "Cannot be empty.",
            "Usually grouped rather than aggregated.",
        ],
        "related_columns": ["Ship_Qty", "Ship_Value", "Factory", "Merchant", "Del_Date"],
        "common_queries": [
            "List all buyers",
            "Top buyers",
            "Shipment quantity by buyer",
            "Shipment value by buyer",
            "Buyer performance",
        ],
    },
    "merchant": {
        "meaning": "Employee or merchant responsible for managing the order.",
        "semantic_type": "Business Entity",
        "description": "Internal merchandiser handling the shipment.",
        "aliases": ["Merchandiser", "Executive", "Coordinator"],
        "sql_usage": ["GROUP BY", "WHERE", "ORDER BY"],
        "business_rules": ["One merchant may manage multiple buyers."],
        "related_columns": ["Buyer", "Factory", "Ship_Value"],
        "common_queries": [
            "Orders by merchant",
            "Top merchants",
            "Shipment value by merchant",
        ],
    },
    "ship_qty": {
        "meaning": "Number of units shipped.",
        "semantic_type": "Quantity",
        "description": "Total number of units dispatched.",
        "aliases": ["Shipment Quantity", "Units", "Pieces", "Quantity"],
        "sql_usage": ["SUM", "AVG", "MAX", "MIN", "ORDER BY"],
        "business_rules": [
            "Cannot be negative.",
            "Usually aggregated using SUM().",
        ],
        "related_columns": ["Buyer", "Factory", "Ship_Value"],
        "common_queries": [
            "Largest shipment",
            "Average shipment quantity",
            "Shipment quantity by buyer",
            "Shipment quantity by factory",
        ],
    },
    "ship_value": {
        "meaning": "Monetary value of the shipment.",
        "semantic_type": "Currency",
        "description": "Financial value of shipped goods.",
        "aliases": ["Shipment Value", "Revenue", "Order Value"],
        "sql_usage": ["SUM", "AVG", "MAX", "MIN", "ORDER BY"],
        "business_rules": ["Cannot be negative.", "Usually aggregated."],
        "related_columns": ["Buyer", "Ship_Qty", "Factory"],
        "common_queries": [
            "Highest shipment value",
            "Average shipment value",
            "Shipment value by buyer",
            "Shipment value by factory",
        ],
    },
    "del_date": {
        "meaning": "Shipment delivery date.",
        "semantic_type": "Date",
        "description": "Date on which shipment was delivered.",
        "aliases": ["Delivery Date", "Shipment Date"],
        "sql_usage": ["WHERE", "BETWEEN", "ORDER BY", "GROUP BY"],
        "business_rules": [
            "Chronological column.",
            "Used for trends.",
            "Used for time filtering.",
        ],
        "related_columns": ["Buyer", "Ship_Qty", "Ship_Value"],
        "common_queries": [
            "Shipments between dates",
            "Monthly shipments",
            "Quarterly shipments",
            "Datewise reports",
        ],
    },
    "oc_qty": {
        "meaning": "Original order confirmation quantity.",
        "semantic_type": "Quantity",
        "description": "Quantity confirmed at order-placement time, before inspection or shipment.",
        "aliases": ["Order Qty", "Confirmed Quantity", "OC Quantity"],
        "sql_usage": ["SUM", "AVG", "ORDER BY"],
        "business_rules": ["Cannot be negative.", "Baseline to compare against Ship_Qty."],
        "related_columns": ["Ship_Qty", "Insp_Qty", "OC_Value"],
        "common_queries": [
            "Order quantity by buyer",
            "OC vs shipped quantity variance",
        ],
    },
    "oc_value": {
        "meaning": "Original order confirmation value.",
        "semantic_type": "Currency",
        "description": "Monetary value confirmed at order-placement time.",
        "aliases": ["Order Value", "Confirmed Value"],
        "sql_usage": ["SUM", "AVG", "ORDER BY"],
        "business_rules": ["Cannot be negative.", "Baseline to compare against Ship_Value."],
        "related_columns": ["Ship_Value", "OC_Qty"],
        "common_queries": ["Order value by buyer", "OC vs shipped value variance"],
    },
    "insp_qty": {
        "meaning": "Quantity inspected during quality check.",
        "semantic_type": "Quantity",
        "description": "Number of units that went through inspection.",
        "aliases": ["Inspection Quantity", "Inspected Units"],
        "sql_usage": ["SUM", "AVG", "ORDER BY"],
        "business_rules": ["Cannot be negative.", "Should not exceed Ship_Qty in most cases."],
        "related_columns": ["Insp_Status", "Insp_Date", "Ship_Qty"],
        "common_queries": ["Inspected quantity by vendor", "Inspection coverage rate"],
    },
    "insp_status": {
        "meaning": "Result of the quality inspection.",
        "semantic_type": "Status",
        "description": "Pass/fail (or similar) outcome of the inspection process.",
        "aliases": ["Inspection Result", "QC Status", "Pass/Fail"],
        "sql_usage": ["WHERE", "GROUP BY", "DISTINCT"],
        "business_rules": ["Typically a small set of categorical values."],
        "related_columns": ["Insp_Qty", "Insp_Date", "Assigned_QA"],
        "common_queries": [
            "Rejection rate by vendor",
            "Inspection pass rate",
            "Failed inspections this month",
        ],
    },
    "insp_date": {
        "meaning": "Date the quality inspection took place.",
        "semantic_type": "Date",
        "description": "Date on which the shipment/order was inspected.",
        "aliases": ["Inspection Date", "QC Date"],
        "sql_usage": ["WHERE", "BETWEEN", "ORDER BY", "GROUP BY"],
        "business_rules": ["Chronological column.", "Used for trend and turnaround analysis."],
        "related_columns": ["Insp_Status", "Insp_Qty", "Del_Date"],
        "common_queries": ["Inspections this month", "Turnaround time from inspection to delivery"],
    },
    "assigned_qa": {
        "meaning": "Quality assurance staff member assigned to the inspection.",
        "semantic_type": "Business Entity",
        "description": "Internal QA inspector responsible for the check.",
        "aliases": ["QA Inspector", "Inspector", "QA Assigned"],
        "sql_usage": ["GROUP BY", "WHERE", "ORDER BY"],
        "business_rules": ["One QA inspector may handle multiple inspections."],
        "related_columns": ["Insp_Status", "Insp_Date"],
        "common_queries": ["Inspections by QA inspector", "QA workload distribution"],
    },
    "factory": {
        "meaning": "Manufacturing facility that produced the goods.",
        "semantic_type": "Business Entity",
        "description": "Vendor/factory location fulfilling the order.",
        "aliases": ["Vendor", "Manufacturer", "Supplier", "Plant"],
        "sql_usage": ["GROUP BY", "DISTINCT", "WHERE", "ORDER BY"],
        "business_rules": ["Cannot be empty.", "Used for vendor performance analysis."],
        "related_columns": ["Buyer", "Ship_Qty", "Ship_Value", "Insp_Status"],
        "common_queries": ["Top vendors", "Vendor performance", "Rejection rate by factory"],
    },
    "country": {
        "meaning": "Destination or origin country for the shipment.",
        "semantic_type": "Location",
        "description": "Country associated with the buyer or shipment.",
        "aliases": ["Nation", "Destination Country"],
        "sql_usage": ["GROUP BY", "DISTINCT", "WHERE"],
        "business_rules": ["Free-text field; values may be inconsistently cased."],
        "related_columns": ["Buyer", "Ship_Value"],
        "common_queries": ["Shipments by country", "Top countries by value"],
    },
    "po_no": {
        "meaning": "Purchase order number.",
        "semantic_type": "Identifier",
        "description": "Unique reference number for the purchase order.",
        "aliases": ["Purchase Order", "PO Number", "Order Number"],
        "sql_usage": ["WHERE", "DISTINCT", "GROUP BY"],
        "business_rules": ["Should be unique or near-unique per order."],
        "related_columns": ["Buyer", "Style", "Factory"],
        "common_queries": ["Look up order by PO number", "Orders per PO"],
    },
}
