// seeds/seeds.js
require('dotenv').config();
const mongoose = require('mongoose');

// Ajuste de paths conforme sua estrutura
const AcademicYear = require('../api/academic-years/academicYear.model');
const YearLevel = require('../api/pedagogy/yearLevel.model');
const Room = require('../api/rooms/rooms.model');
const ClassModel = require('../api/classes/classes.model');
const Subject = require('../api/subjects/subjects.model');
const EducationalSegment = require('../api/pedagogy/educationalSegment.model');

async function main() {
	const { MONGO_URI, SCHOOL_ID } = process.env;
	if (!MONGO_URI || !SCHOOL_ID) {
		console.error('❌ Defina MONGO_URI e SCHOOL_ID no .env');
		process.exit(1);
	}

	await mongoose.connect(MONGO_URI, {
		useNewUrlParser: true,
		useUnifiedTopology: true,
	});
	console.log('✔️  Conectado ao MongoDB');

	// 1) ANOS ACADÊMICOS
	const academicYearsData = [
		{
			year: '2023-2024',
			title: 'Ano Letivo 2023/2024',
			startDate: new Date('2023-08-01'),
			endDate: new Date('2024-06-30'),
			isCurrent: false,
			description: 'Ano letivo anterior',
			school: SCHOOL_ID
		},
		{
			year: '2024-2025',
			title: 'Ano Letivo 2024/2025',
			startDate: new Date('2024-08-01'),
			endDate: new Date('2025-06-30'),
			isCurrent: true,
			description: 'Ano letivo atual',
			school: SCHOOL_ID
		},
	];
	const academicYears = await AcademicYear.insertMany(academicYearsData);
	console.log(`✔️  Criados ${academicYears.length} anos acadêmicos`);
	const activeAY = academicYears.find(ay => ay.isCurrent);

	// 2) SEGMENTOS EDUCACIONAIS
	const segmentsData = [
		{
			name: 'Ensino Fundamental I',
			acronym: 'EF1',
			description: '1º ao 5º ano',
			school: SCHOOL_ID
		},
		{
			name: 'Ensino Fundamental II',
			acronym: 'EF2',
			description: '6º ao 9º ano',
			school: SCHOOL_ID
		}
	];
	const segments = await EducationalSegment.insertMany(segmentsData);
	console.log(`✔️  Criados ${segments.length} segmentos educacionais`);

	// 3) YEAR LEVELS
	const yearLevelsData = [
		{ 
			name: '1º Ano', 
			acronym: '1A', 
			academicYear: activeAY._id, 
			educationalSegment: segments[0]._id,
			school: SCHOOL_ID 
		},
		{ 
			name: '2º Ano', 
			acronym: '2A', 
			academicYear: activeAY._id, 
			educationalSegment: segments[0]._id,
			school: SCHOOL_ID 
		},
		{ 
			name: '3º Ano', 
			acronym: '3A', 
			academicYear: activeAY._id, 
			educationalSegment: segments[0]._id,
			school: SCHOOL_ID 
		},
	];
	const yearLevels = await YearLevel.insertMany(yearLevelsData);
	console.log(`✔️  Criados ${yearLevels.length} year levels`);

	// 4) SALAS
	const roomsData = [
		{
			name: 'Laboratório 101',
			location: 'Bloco A, 1º andar',
			capacity: 30,
			resources: ['Projetor', 'Ar condicionado'],
			school: SCHOOL_ID
		},
		{
			name: 'Sala 202',
			location: 'Bloco B, 2º andar',
			capacity: 25,
			resources: ['Quadro branco'],
			school: SCHOOL_ID
		},
	];
	const rooms = await Room.insertMany(roomsData);
	console.log(`✔️  Criadas ${rooms.length} salas`);

	// 5) TURMAS
	const classesData = [
		{
			name: 'Turma 1A Manhã',
			academicYear: activeAY._id,
			yearLevel: yearLevels.find(yl => yl.acronym === '1A')._id,
			section: 'Manhã',
			room: rooms[0]._id,
			startDate: activeAY.startDate,
			endDate: activeAY.endDate,
			maxCapacity: rooms[0].capacity,
			school: SCHOOL_ID
		},
		{
			name: 'Turma 1A Tarde',
			academicYear: activeAY._id,
			yearLevel: yearLevels.find(yl => yl.acronym === '1A')._id,
			section: 'Tarde',
			room: rooms[1]._id,
			startDate: activeAY.startDate,
			endDate: activeAY.endDate,
			maxCapacity: rooms[1].capacity,
			school: SCHOOL_ID
		},
	];
	const classes = await ClassModel.insertMany(classesData);
	console.log(`✔️  Criadas ${classes.length} turmas`);

	// 6) DISCIPLINAS
	const subjectsData = [
		{
			name: 'Matemática',
			code: 'MAT101',
			academicYear: activeAY._id,
			yearLevel: yearLevels[0]._id,
			type: 'mandatory',
			employees: [],
			description: 'Fundamentos de Matemática',
			school: SCHOOL_ID
		},
		{
			name: 'Português',
			code: 'POR101',
			academicYear: activeAY._id,
			yearLevel: yearLevels[0]._id,
			type: 'mandatory',
			employees: [],
			description: 'Língua Portuguesa',
			school: SCHOOL_ID
		},
	];
	const subjects = await Subject.insertMany(subjectsData);
	console.log(`✔️  Criadas ${subjects.length} disciplinas`);

	await mongoose.disconnect();
	console.log('🏁 Seed concluído com sucesso!');
}

main().catch(err => {
	console.error('❌ Erro no seed:', err);
	process.exit(1);
});
