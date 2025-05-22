// School Socket
// ./api/schools/school.socket.js

class SchoolSocketService {
	static async broadcastToSchool(io, schoolId, event, data) {
		try {
			const room = `school:${schoolId}`;
			
			// Log the broadcast attempt
			console.log('Broadcasting to school room:', {
				room,
				event,
				data
			});

			// Check if the room exists
			// const rooms = io.sockets.adapter.rooms;
			// const roomExists = rooms.has(room);
			
			// Emit to room
			io.to(room).emit(event, data);

			return true;
		} catch (error) {
			console.error('Error broadcasting to school:', error);
			return false;
		}
	}

	static async getUsersInSchool(schoolId, activeConnections) {
		return Array.from(activeConnections.get(schoolId) || []);
	}

	static async notifyUserStatusChange(io, schoolId, user, status) {
		await this.broadcastToSchool(io, schoolId, 'user:status_change', {
			user,
			status,
			timestamp: new Date().toISOString()
		});
	}
}

module.exports = SchoolSocketService;