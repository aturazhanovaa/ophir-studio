# Backend API Guidelines

Auth:
- JWT access token in Authorization: Bearer <token>
- Return 401 for invalid token, 403 for forbidden

Errors:
- Always return JSON: { "detail": "message" }
- For validation: 422 with details

Conventions:
- Endpoints use nouns: /documents, /areas
- Pagination: limit, offset
- Search: q parameter
