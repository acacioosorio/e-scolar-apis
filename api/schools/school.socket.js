class SchoolSocketService {
	static async broadcastToSchool(io, schoolId, event, data) {
		io.to(`school:${schoolId}`).emit(event, data);
	}

	static async getUsersInSchool(schoolId, activeConnections) {
		return Array.from(activeConnections.get(schoolId) || []);
	}

	static async notifyUserStatusChange(io, schoolId, userId, status) {
		await this.broadcastToSchool(io, schoolId, 'user:status_change', {
			userId,
			status,
			timestamp: new Date().toISOString()
		});
	}
}

module.exports = SchoolSocketService;