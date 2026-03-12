use serde_json::{Map, Value, json};

/// SuperJSON encoding/decoding utilities for SplitPro tRPC communication.
///
/// SplitPro's tRPC uses SuperJSON as its transformer, which encodes special types
/// like BigInt with metadata. This module handles the encoding/decoding.
///
/// SuperJSON format for mutations:
/// ```json
/// {
///   "json": { "amount": "5000", ... },
///   "meta": { "values": { "amount": ["bigint"], "participants.0.amount": ["bigint"] } }
/// }
/// ```
///
/// SuperJSON format for query inputs (URL-encoded):
/// ```text
/// ?input={"json":{"expenseId":"uuid-here"}}
/// ```

/// Encode a request body with BigInt metadata for tRPC mutations.
///
/// Takes a JSON value and a list of dot-separated paths that should be marked as BigInt.
/// Returns the SuperJSON-encoded body ready for POST to tRPC.
///
/// # Arguments
///
/// * `data` - The JSON data to encode
/// * `bigint_paths` - Dot-separated paths to fields that are BigInt values (e.g., "amount", "participants.0.amount")
///
/// # Example
///
/// ```no_run
/// use serde_json::json;
/// use master_of_coin_backend::services::split_provider::superjson::encode_mutation_body;
/// let data = json!({"amount": "5000", "name": "Test"});
/// let encoded = encode_mutation_body(&data, &["amount"]);
/// // Result: {"json": {"amount": "5000", "name": "Test"}, "meta": {"values": {"amount": ["bigint"]}}}
/// ```
pub fn encode_mutation_body(data: &Value, bigint_paths: &[&str]) -> Value {
    encode_mutation_body_with_dates(data, bigint_paths, &[])
}

/// Encode a request body with BigInt and Date metadata for tRPC mutations.
///
/// Takes a JSON value, a list of BigInt paths, and a list of Date paths.
/// Returns the SuperJSON-encoded body ready for POST to tRPC.
pub fn encode_mutation_body_with_dates(
    data: &Value,
    bigint_paths: &[&str],
    date_paths: &[&str],
) -> Value {
    let mut meta_values = Map::new();
    for path in bigint_paths {
        meta_values.insert(path.to_string(), json!(["bigint"]));
    }
    for path in date_paths {
        meta_values.insert(path.to_string(), json!(["Date"]));
    }

    if meta_values.is_empty() {
        json!({ "json": data })
    } else {
        json!({
            "json": data,
            "meta": {
                "values": meta_values
            }
        })
    }
}

/// Encode a query input for tRPC GET requests.
///
/// Returns a URL-encoded string suitable for the `input` query parameter.
/// For queries without BigInt values, this is simply `{"json": data}`.
///
/// # Arguments
///
/// * `data` - The JSON data to encode as query input
/// * `bigint_paths` - Dot-separated paths to BigInt fields (usually empty for queries)
pub fn encode_query_input(data: &Value, bigint_paths: &[&str]) -> String {
    let encoded = encode_mutation_body(data, bigint_paths);
    // URL-encode the JSON string for use as a query parameter
    urlencoding::encode(&encoded.to_string()).into_owned()
}

/// Decode a SuperJSON response from tRPC.
///
/// SuperJSON responses wrap the actual data in a `result.data` structure for queries
/// and `result.data` for mutations. BigInt values are returned as strings with metadata.
///
/// For tRPC batch responses, the format is:
/// ```json
/// [{"result":{"data":{"json":{...},"meta":{...}}}}]
/// ```
///
/// For single responses:
/// ```json
/// {"result":{"data":{"json":{...},"meta":{...}}}}
/// ```
///
/// This function extracts the `json` field and converts BigInt string values
/// back to their string representation (which is what we want for amounts).
pub fn decode_response(response: &Value) -> Option<Value> {
    // Handle batch response (array)
    let result_data = if let Some(arr) = response.as_array() {
        arr.first()
            .and_then(|item| item.get("result"))
            .and_then(|result| result.get("data"))
    } else {
        // Handle single response
        response.get("result").and_then(|result| result.get("data"))
    };

    result_data.and_then(|data| {
        // SuperJSON wraps data in {"json": ..., "meta": ...}
        if let Some(json_data) = data.get("json") {
            Some(json_data.clone())
        } else {
            // If no SuperJSON wrapper, return data as-is
            Some(data.clone())
        }
    })
}

/// Decode a tRPC error response.
///
/// tRPC error format:
/// ```json
/// [{"error":{"message":"...","code":-32600,"data":{"code":"UNAUTHORIZED","httpStatus":401}}}]
/// ```
///
/// Returns `(error_code, message)` if this is an error response.
pub fn decode_error(response: &Value) -> Option<(String, String)> {
    // Handle batch response (array)
    let error = if let Some(arr) = response.as_array() {
        arr.first().and_then(|item| item.get("error"))
    } else {
        response.get("error")
    };

    error.map(|err| {
        let code = err
            .get("data")
            .and_then(|d| d.get("code"))
            .and_then(|c| c.as_str())
            .unwrap_or("UNKNOWN")
            .to_string();

        let message = err
            .get("message")
            .and_then(|m| m.as_str())
            .unwrap_or("Unknown error")
            .to_string();

        (code, message)
    })
}

/// Convert a decimal amount string (e.g., "100.00") to a BigInt value for SplitPro.
///
/// SplitPro stores amounts as BigInt in the smallest currency unit (cents).
/// Most currencies use 2 decimal places, so "100.00" becomes 10000.
///
/// # Arguments
///
/// * `amount_str` - Decimal amount string (e.g., "100.00", "50.5", "200")
///
/// # Returns
///
/// The BigInt value as an i64, or an error if parsing fails.
pub fn amount_to_bigint(amount_str: &str) -> Result<i64, String> {
    let amount_str = amount_str.trim();

    if amount_str.is_empty() {
        return Err("Empty amount string".to_string());
    }

    // Parse the decimal string
    let parts: Vec<&str> = amount_str.split('.').collect();

    match parts.len() {
        1 => {
            // No decimal point: "100" → 10000
            let whole: i64 = parts[0]
                .parse()
                .map_err(|e| format!("Invalid whole number '{}': {}", parts[0], e))?;
            Ok(whole * 100)
        }
        2 => {
            let whole: i64 = parts[0]
                .parse()
                .map_err(|e| format!("Invalid whole number '{}': {}", parts[0], e))?;

            let decimal_str = parts[1];
            let decimal_len = decimal_str.len();

            let decimal_value: i64 = if decimal_str.is_empty() {
                0
            } else {
                decimal_str
                    .parse()
                    .map_err(|e| format!("Invalid decimal '{}': {}", decimal_str, e))?
            };

            // Normalize to 2 decimal places
            let normalized = match decimal_len {
                0 => 0,
                1 => decimal_value * 10, // "50.5" → 50
                2 => decimal_value,      // "50.50" → 50
                _ => {
                    // More than 2 decimal places: round to 2
                    let divisor = 10_i64.pow((decimal_len - 2) as u32);
                    (decimal_value + divisor / 2) / divisor
                }
            };

            let sign = if whole < 0 || amount_str.starts_with('-') {
                -1
            } else {
                1
            };

            Ok(sign * (whole.abs() * 100 + normalized))
        }
        _ => Err(format!("Invalid amount format: '{}'", amount_str)),
    }
}

/// Convert a BigInt value from SplitPro to a decimal amount string.
///
/// Converts the smallest currency unit back to a decimal string.
/// E.g., 10000 → "100.00", -5050 → "-50.50"
///
/// # Arguments
///
/// * `bigint` - The BigInt value from SplitPro
///
/// # Returns
///
/// A decimal string with 2 decimal places.
pub fn bigint_to_amount(bigint: i64) -> String {
    let sign = if bigint < 0 { "-" } else { "" };
    let abs_val = bigint.unsigned_abs();
    let whole = abs_val / 100;
    let cents = abs_val % 100;
    format!("{}{}.{:02}", sign, whole, cents)
}

/// Generate BigInt metadata paths for an array of participants.
///
/// Given a base path and count, generates paths like:
/// - "participants.0.amount"
/// - "participants.1.amount"
/// - etc.
///
/// # Arguments
///
/// * `base_path` - The base array path (e.g., "participants")
/// * `field` - The field name within each element (e.g., "amount")
/// * `count` - Number of array elements
pub fn bigint_array_paths(base_path: &str, field: &str, count: usize) -> Vec<String> {
    (0..count)
        .map(|i| format!("{}.{}.{}", base_path, i, field))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_encode_mutation_body_with_bigints() {
        let data = json!({
            "amount": "5000",
            "name": "Test Expense",
            "participants": [
                {"userId": 1, "amount": "2500"},
                {"userId": 2, "amount": "2500"}
            ]
        });

        let encoded = encode_mutation_body(
            &data,
            &["amount", "participants.0.amount", "participants.1.amount"],
        );

        assert_eq!(encoded["json"], data);
        assert_eq!(encoded["meta"]["values"]["amount"], json!(["bigint"]));
        assert_eq!(
            encoded["meta"]["values"]["participants.0.amount"],
            json!(["bigint"])
        );
        assert_eq!(
            encoded["meta"]["values"]["participants.1.amount"],
            json!(["bigint"])
        );
    }

    #[test]
    fn test_encode_mutation_body_no_bigints() {
        let data = json!({"expenseId": "some-uuid"});
        let encoded = encode_mutation_body(&data, &[]);

        assert_eq!(encoded["json"], data);
        assert!(encoded.get("meta").is_none());
    }

    #[test]
    fn test_encode_query_input() {
        let data = json!({"expenseId": "some-uuid"});
        let encoded = encode_query_input(&data, &[]);

        // Should be URL-encoded JSON
        assert!(encoded.contains("json"));
        assert!(encoded.contains("some-uuid"));
        // Should not contain raw braces (they should be encoded)
        assert!(!encoded.contains('{'));
    }

    #[test]
    fn test_decode_response_batch() {
        let response = json!([{
            "result": {
                "data": {
                    "json": {"id": "expense-123", "name": "Test"},
                    "meta": {"values": {"amount": ["bigint"]}}
                }
            }
        }]);

        let decoded = decode_response(&response).unwrap();
        assert_eq!(decoded["id"], "expense-123");
        assert_eq!(decoded["name"], "Test");
    }

    #[test]
    fn test_decode_response_single() {
        let response = json!({
            "result": {
                "data": {
                    "json": {"id": 1, "name": "User"},
                    "meta": {}
                }
            }
        });

        let decoded = decode_response(&response).unwrap();
        assert_eq!(decoded["id"], 1);
        assert_eq!(decoded["name"], "User");
    }

    #[test]
    fn test_decode_error_batch() {
        let response = json!([{
            "error": {
                "message": "Not authorized",
                "code": -32600,
                "data": {
                    "code": "UNAUTHORIZED",
                    "httpStatus": 401
                }
            }
        }]);

        let (code, message) = decode_error(&response).unwrap();
        assert_eq!(code, "UNAUTHORIZED");
        assert_eq!(message, "Not authorized");
    }

    #[test]
    fn test_decode_error_single() {
        let response = json!({
            "error": {
                "message": "Expense not found",
                "code": -32600,
                "data": {
                    "code": "NOT_FOUND",
                    "httpStatus": 404
                }
            }
        });

        let (code, message) = decode_error(&response).unwrap();
        assert_eq!(code, "NOT_FOUND");
        assert_eq!(message, "Expense not found");
    }

    #[test]
    fn test_decode_error_not_error() {
        let response = json!([{
            "result": {
                "data": {"json": {"id": 1}}
            }
        }]);

        assert!(decode_error(&response).is_none());
    }

    #[test]
    fn test_amount_to_bigint_whole_number() {
        assert_eq!(amount_to_bigint("100").unwrap(), 10000);
        assert_eq!(amount_to_bigint("0").unwrap(), 0);
        assert_eq!(amount_to_bigint("1").unwrap(), 100);
    }

    #[test]
    fn test_amount_to_bigint_two_decimals() {
        assert_eq!(amount_to_bigint("100.00").unwrap(), 10000);
        assert_eq!(amount_to_bigint("50.50").unwrap(), 5050);
        assert_eq!(amount_to_bigint("0.01").unwrap(), 1);
        assert_eq!(amount_to_bigint("99.99").unwrap(), 9999);
    }

    #[test]
    fn test_amount_to_bigint_one_decimal() {
        assert_eq!(amount_to_bigint("50.5").unwrap(), 5050);
        assert_eq!(amount_to_bigint("0.1").unwrap(), 10);
    }

    #[test]
    fn test_amount_to_bigint_three_decimals() {
        assert_eq!(amount_to_bigint("50.505").unwrap(), 5051); // rounds up
        assert_eq!(amount_to_bigint("50.504").unwrap(), 5050); // rounds down
    }

    #[test]
    fn test_amount_to_bigint_negative() {
        assert_eq!(amount_to_bigint("-100.00").unwrap(), -10000);
        assert_eq!(amount_to_bigint("-50.50").unwrap(), -5050);
    }

    #[test]
    fn test_amount_to_bigint_invalid() {
        assert!(amount_to_bigint("").is_err());
        assert!(amount_to_bigint("abc").is_err());
        assert!(amount_to_bigint("1.2.3").is_err());
    }

    #[test]
    fn test_bigint_to_amount() {
        assert_eq!(bigint_to_amount(10000), "100.00");
        assert_eq!(bigint_to_amount(5050), "50.50");
        assert_eq!(bigint_to_amount(1), "0.01");
        assert_eq!(bigint_to_amount(0), "0.00");
        assert_eq!(bigint_to_amount(9999), "99.99");
    }

    #[test]
    fn test_bigint_to_amount_negative() {
        assert_eq!(bigint_to_amount(-10000), "-100.00");
        assert_eq!(bigint_to_amount(-5050), "-50.50");
    }

    #[test]
    fn test_bigint_amount_roundtrip() {
        let original = "123.45";
        let bigint = amount_to_bigint(original).unwrap();
        let back = bigint_to_amount(bigint);
        assert_eq!(back, original);
    }

    #[test]
    fn test_bigint_array_paths() {
        let paths = bigint_array_paths("participants", "amount", 3);
        assert_eq!(
            paths,
            vec![
                "participants.0.amount",
                "participants.1.amount",
                "participants.2.amount",
            ]
        );
    }

    #[test]
    fn test_bigint_array_paths_empty() {
        let paths = bigint_array_paths("participants", "amount", 0);
        assert!(paths.is_empty());
    }
}
