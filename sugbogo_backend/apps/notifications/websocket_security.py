class NotificationOriginValidator:
    """Allow configured browser origins and token-authenticated native clients."""

    def __init__(self, application, allowed_origins):
        """Store the application and explicit browser-origin allowlist."""
        self.application = application
        self.allowed_origins = set(allowed_origins)

    async def __call__(self, scope, receive, send):
        """Reject unknown or duplicate browser origins before socket acceptance."""
        origins = [
            value.decode("latin1")
            for name, value in scope.get("headers", [])
            if name.lower() == b"origin"
        ]
        if origins and (len(origins) != 1 or origins[0] not in self.allowed_origins):
            await send({"type": "websocket.close", "code": 4403})
            return
        await self.application(scope, receive, send)
