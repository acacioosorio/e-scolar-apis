require('dotenv').config();
module.exports = async (mongoose) => {
	try {
		await mongoose.connect(process.env.MONGO_URI, {
			useNewUrlParser: true,
			useUnifiedTopology: true,
		});
		console.log('Connected to MongoDB with success!');
	} catch (error) {
		console.error('Error on connect to MongoDB:', error);
		process.exit(1);
	}
};