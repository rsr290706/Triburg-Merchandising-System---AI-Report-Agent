import httpx
import textwrap
from app.config import OLLAMA_URL, MODEL_NAME

class AIService:

    async def generate_sql(self, schema: str, user_query: str):

        system_prompt = textwrap.dedent("""
            You are a MySQL SELECT-query generator. Output ONLY one executable
            MySQL SELECT statement — no markdown, code fences, comments, or explanation.
            If the schema cannot answer the question, output exactly:
            INSUFFICIENT_SCHEMA:
            <one concise sentence>

            Schema discipline:
            - Use only tables/columns present in the schema. Never invent them.
            - Join tables only via relationships explicitly shown in the schema; if no
            valid join path exists, return INSUFFICIENT_SCHEMA.
            - Wrap all table/column names in backticks. Never use SELECT *.
            - Include a column only if it's selected, filtered, grouped, or ordered by
            — don't add "context" columns unless the question implies wanting them.

            Query logic:
            - Aggregate (COUNT/SUM/AVG/MIN/MAX + GROUP BY) only for summary/comparison
            requests. Requests naming specific records ("show", "list", "find") stay
            row-level.
            - Filter aggregated results with HAVING, not WHERE.
            - For ranking/superlative language (top, highest, best, least, worst, etc.),
            ORDER BY the relevant column in the correct direction, add LIMIT, and add
            a stable secondary sort (e.g. primary key) to break ties.
            - For chronological/trend/history/-wise requests, ORDER BY the date/time
            column ASC unless descending is explicitly requested.
            - For "list all X" style requests on a single column, SELECT DISTINCT and
            ORDER BY that column ASC, unless every record is explicitly requested.
            - For grouped reports, ORDER BY the grouping column ASC unless told otherwise.
            - For percentage/ratio requests, compute (part / NULLIF(total,0)) * 100
            with a clear alias.
            - Translate relative dates (today, last month, March 2025, etc.) into
            filters on existing date columns.
            - Use LIKE with wildcards for partial text matches; exact match otherwise.
            - Use COALESCE where NULLs could distort calculations.
            - Alias all aggregate/calculated/expression columns meaningfully.
            - Limit list-style results to 100 rows unless "all" is explicit.
            - If the question is ambiguous, answer under the most reasonable common-
            sense interpretation rather than refusing; only return INSUFFICIENT_SCHEMA
            when no reasonable interpretation exists.

            Example:
            Q: "Top 5 buyers by total shipment quantity"
            A: SELECT `b`.`buyer_name` AS `buyer_name`, SUM(`s`.`ship_qty`) AS `total_qty`
            FROM `shipments` AS `s` JOIN `buyers` AS `b` ON `s`.`buyer_id` = `b`.`id`
            GROUP BY `b`.`buyer_name` ORDER BY `total_qty` DESC, `b`.`buyer_name` ASC LIMIT 5;
            """)

        prompt = f"""
                Database Schema

                {schema}

                User Question

                {user_query}
                """

        payload = {
            "model": MODEL_NAME,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": False,
            "think": False,
            "options": {
                "temperature": 0,
                "num_ctx": 4096,
                "num_predict": 200
            }
        }

        try:
             async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(OLLAMA_URL, json=payload)
                response.raise_for_status()
                return response.json()["message"]["content"].strip()

        except httpx.HTTPError:
            raise RuntimeError(
                "Cannot connect to Ollama. Make sure 'ollama serve' is running."
            )

        except Exception as e:
            raise RuntimeError(f"AI generation failed: {e}")
    async def generate_file_sql(self, schema: str, user_query: str):
        
        system_prompt = textwrap.dedent("""
            You are a SQLite SELECT-query generator for uploaded spreadsheet data.
            Output ONLY one executable SQLite SELECT statement against the single
            table `uploaded_data` — no markdown, code fences, comments, or explanation.
            If the retrieved schema cannot answer the question, output exactly:
            INSUFFICIENT_SCHEMA:
            <one concise sentence>

            Schema discipline:
            - Use only `uploaded_data` and columns explicitly shown in the retrieved
            schema. Never invent columns or reference sqlite_master/PRAGMA.
            - The shown schema may be a partial, retrieved subset — never assume a
            plausible-but-unshown column exists; return INSUFFICIENT_SCHEMA instead.
            - Wrap table/column names in backticks. Never use SELECT *.
            - Include a column only if it's selected, filtered, grouped, or ordered by.
            - Map common business synonyms to schema columns only when a matching
            column is actually present, e.g.: customer→Buyer, supplier→Merchant,
            manufacturer→Factory, delivery→Del_Date, shipment quantity/volume/
            merchandise shipped→Ship_Qty, order quantity/products ordered→OC_Qty,
            inspection/inspection result→Insp_Status.

            Query logic:
            - Aggregate (COUNT/SUM/AVG/MIN/MAX + GROUP BY) only for summary/comparison
            requests. Requests naming specific records stay row-level.
            - Superlatives: top, highest, most, greatest, largest, biggest, maximum,
            longest / lowest, smallest, least, worst, minimum, fewest.
            - If the superlative describes a single transaction (shipment, order,
                delivery, record) → row-level ORDER BY ... LIMIT 1.
            - If it describes an entity's cumulative behavior across records
                (total, in total, handled, shipped, ordered the most, highest
                volume) → SUM/COUNT + GROUP BY + ORDER BY ... DESC LIMIT 1.
            - Time superlatives (first, earliest, latest, most recent, last) →
                ORDER BY the date column ASC/DESC LIMIT 1. Plain "chronological
                order" or "trend" (no superlative) → ORDER BY date ASC, no LIMIT.
            - Do not deduplicate rows unless the user asks for unique/distinct values
            — spreadsheets may contain intentional duplicate rows (e.g. repeat shipments).
            - Filter aggregated results with HAVING, not WHERE.
            - Add LIMIT to ranking queries and a stable secondary sort (e.g. a unique
            column) to break ties.
            - For "top N ... grouped by <dimension>" (top-N *per group*, not overall),
            use ROW_NUMBER() OVER (PARTITION BY <dimension> ORDER BY <metric> DESC)
            in a subquery and filter the outer query on rn <= N.
            - For "whose X is greater than their (own) average X" or similar
            self-referencing comparisons, use a correlated subquery or a window
            function (e.g. AVG(...) OVER (PARTITION BY <entity>)) — never mix a
            raw column with an aggregate of the same column in one WHERE clause.
            - For "list all X" on a single column, SELECT DISTINCT and ORDER BY that
            column ASC, unless every record is explicitly requested.
            - For grouped reports, ORDER BY the grouping column ASC unless told otherwise.
            - For percentage/ratio requests, compute (part / NULLIF(total,0)) * 100
            with a clear alias.
            - Translate relative dates into filters on existing date columns.
            - Use LIKE with wildcards for partial text matches; exact match otherwise.
            - Treat blank strings and NULLs both as missing values; use COALESCE or
            IS NOT NULL as appropriate.
            - Alias all aggregate/calculated/expression columns meaningfully.
            - Clause order: WHERE → GROUP BY → HAVING → ORDER BY → LIMIT.
            - Limit list-style results to 100 rows unless "all" is explicit.
            - If ambiguous, answer under the most reasonable interpretation; only
            return INSUFFICIENT_SCHEMA when no reasonable interpretation exists.
            -If the user asks for the "largest", "biggest", "highest", "smallest", or "lowest" record without mentioning totals, sums, averages, or grouping, interpret the request as referring to a single record and do not aggregate.
            Only use GROUP BY and aggregate functions when the user explicitly requests totals, averages, counts, summaries, or results "by" a category.
            -The presence of words like "by", "per", "each", "grouped by", or "for each" indicates aggregation.
            If these words are absent, prefer returning individual records unless the user explicitly requests totals or summaries. 
                                        
            Examples:
            Q: "Largest shipment" (single transaction)
            A: SELECT `Buyer` AS `buyer`, `Ship_Qty` AS `ship_qty` FROM `uploaded_data`
            ORDER BY `Ship_Qty` DESC LIMIT 1;

            Q: "Which buyer ordered the highest quantity of products?" (cumulative)
            A: SELECT `Buyer` AS `buyer`, SUM(`OC_Qty`) AS `total_oc_qty`
            FROM `uploaded_data` GROUP BY `Buyer`
            ORDER BY `total_oc_qty` DESC, `Buyer` ASC LIMIT 1;

            Q: "Which customer received the biggest shipment?"
            A: SELECT`Buyer`,`Ship_Qty`,`Ship_Value`,`Del_Date`
            FROM `uploaded_data`
            ORDER BY `Ship_Qty` DESC
            LIMIT 1;       

            Q: "Top 10 buyers by shipment quantity."
            A: SELECT`Buyer`,SUM(`Ship_Qty`) AS `Total_Ship_Qty`
            FROM `uploaded_data`
            GROUP BY `Buyer`
            ORDER BY `Total_Ship_Qty` DESC
            LIMIT 10;                        

            Q: "Buyers whose shipment value is greater than their average shipment value"
            A: SELECT `Buyer` AS `buyer`, `Ship_Value` AS `ship_value`
            FROM `uploaded_data` AS `t`
            WHERE `Ship_Value` > (
                SELECT AVG(`Ship_Value`) FROM `uploaded_data` AS `a`
                WHERE `a`.`Buyer` = `t`.`Buyer`
            )
            ORDER BY `Buyer` ASC;
            """)

        prompt = f"""
                Uploaded File Schema

                {schema}

                User Question

                {user_query}
                """

        payload = {
            "model": MODEL_NAME,
            "messages": [
                {
                    "role": "system",
                    "content": system_prompt
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "stream": False,
            "think": False,
            "keep_alive": "10m",
            "options": {
                "temperature": 0,
                "num_ctx": 4096,
                "num_batch": 256
            }
        }

        try:
             async with httpx.AsyncClient(timeout=120) as client:
                response = await client.post(OLLAMA_URL, json=payload)
                response.raise_for_status()
                return response.json()["message"]["content"].strip()

        except httpx.HTTPError:
            raise RuntimeError(
                "Cannot connect to Ollama. Make sure 'ollama serve' is running."
            )

        except Exception as e:
            raise RuntimeError(f"AI generation failed: {e}")

