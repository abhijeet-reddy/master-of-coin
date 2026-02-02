use uuid::Uuid;

use crate::models::{ApiKeyScopes, OperationType, ResourceType, User};

/// Authentication context that can be either JWT or API Key based
///
/// This enum represents the authentication method used for a request.
/// JWT tokens have full access to all resources, while API keys have
/// scoped permissions that must be checked for each operation.
#[derive(Debug, Clone)]
pub enum AuthContext {
    /// JWT token authentication (full access)
    Jwt { user: User },
    /// API key authentication (scoped access)
    ApiKey {
        user: User,
        api_key_id: Uuid,
        scopes: ApiKeyScopes,
    },
}

impl AuthContext {
    /// Get the authenticated user
    ///
    /// # Returns
    /// * `&User` - Reference to the authenticated user
    pub fn user(&self) -> &User {
        match self {
            AuthContext::Jwt { user } => user,
            AuthContext::ApiKey { user, .. } => user,
        }
    }

    /// Get the user ID
    ///
    /// # Returns
    /// * `Uuid` - The user's ID
    pub fn user_id(&self) -> Uuid {
        self.user().id
    }

    /// Check if the authentication context has permission for a resource and operation
    ///
    /// # Arguments
    /// * `resource` - The resource type being accessed
    /// * `operation` - The operation type being performed
    ///
    /// # Returns
    /// * `bool` - True if permission is granted, false otherwise
    ///
    /// # Logic
    /// - JWT tokens always have full access (return true)
    /// - API keys must have the specific scope for the resource and operation
    pub fn has_permission(&self, resource: ResourceType, operation: OperationType) -> bool {
        match self {
            AuthContext::Jwt { .. } => true, // JWT has full access
            AuthContext::ApiKey { scopes, .. } => scopes.has_permission(resource, operation),
        }
    }

    /// Check if this is JWT authentication
    ///
    /// # Returns
    /// * `bool` - True if authenticated via JWT
    pub fn is_jwt(&self) -> bool {
        matches!(self, AuthContext::Jwt { .. })
    }

    /// Check if this is API key authentication
    ///
    /// # Returns
    /// * `bool` - True if authenticated via API key
    pub fn is_api_key(&self) -> bool {
        matches!(self, AuthContext::ApiKey { .. })
    }

    /// Get the API key ID if authenticated via API key
    ///
    /// # Returns
    /// * `Option<Uuid>` - The API key ID if authenticated via API key, None otherwise
    pub fn api_key_id(&self) -> Option<Uuid> {
        match self {
            AuthContext::ApiKey { api_key_id, .. } => Some(*api_key_id),
            _ => None,
        }
    }

    /// Get the scopes if authenticated via API key
    ///
    /// # Returns
    /// * `Option<&ApiKeyScopes>` - The scopes if authenticated via API key, None otherwise
    pub fn scopes(&self) -> Option<&ApiKeyScopes> {
        match self {
            AuthContext::ApiKey { scopes, .. } => Some(scopes),
            _ => None,
        }
    }
}
