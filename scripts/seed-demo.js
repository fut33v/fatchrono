#!/usr/bin/env node
/* eslint-disable no-console */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const RACE_ID = "test-race";

const CATEGORY_DEFS = [
  { name: "МТБ М", order: 0 },
  { name: "МТБ Ж", order: 1 },
  { name: "ГРЕВЕЛ М", order: 2 },
  { name: "ГРЕВЕЛ Ж", order: 3 },
];

const PARTICIPANT_NAMES = {
  "МТБ М": [
    "Иван Петров",
    "Алексей Смирнов",
    "Дмитрий Кузнецов",
    "Сергей Попов",
    "Никита Волков",
    "Павел Соколов",
    "Михаил Сафонов",
    "Григорий Орлов",
    "Андрей Степанов",
    "Егор Зайцев",
  ],
  "МТБ Ж": [
    "Анна Иванова",
    "Мария Крылова",
    "Светлана Федорова",
    "Дарья Николаева",
    "Полина Павлова",
    "Екатерина Лебедева",
    "Вера Комарова",
    "Ольга Родина",
    "Юлия Морозова",
    "Елена Белова",
  ],
  "ГРЕВЕЛ М": [
    "Владислав Романов",
    "Степан Филиппов",
    "Арсений Егоров",
    "Илья Кондратьев",
    "Лев Чернов",
    "Роман Карпов",
    "Тимур Алексеев",
    "Федор Афанасьев",
    "Матвей Логинов",
    "Борис Демидов",
  ],
  "ГРЕВЕЛ Ж": [
    "Алиса Сергеева",
    "Наталья Киселева",
    "Татьяна Полякова",
    "Ксения Васильева",
    "Инга Рыбакова",
    "Анастасия Гордеева",
    "Лилия Фомина",
    "Жанна Короткова",
    "София Цветкова",
    "Валерия Андреева",
  ],
};

async function resetRace(raceId) {
  await prisma.tapEvent.deleteMany({ where: { raceId } });
  await prisma.participant.deleteMany({ where: { raceId } });
  await prisma.category.deleteMany({ where: { raceId } });
  await prisma.race.delete({ where: { id: raceId } }).catch(() => undefined);
}

async function seedRace() {
  console.log("🌱  Creating demo race…");
  await resetRace(RACE_ID);

  const race = await prisma.race.create({
    data: {
      id: RACE_ID,
      name: "Тестовая гонка",
      totalLaps: 8,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  const categories = await Promise.all(
    CATEGORY_DEFS.map((category) =>
      prisma.category.create({
        data: {
          raceId: race.id,
          name: category.name,
          order: category.order,
        },
      }),
    ),
  );

  const categoryMap = new Map(categories.map((category) => [category.name, category.id]));

  let bib = 1;
  const participantsPayload = [];

  for (const category of CATEGORY_DEFS) {
    const names = PARTICIPANT_NAMES[category.name];
    const categoryId = categoryMap.get(category.name);
    if (!categoryId) {
      throw new Error(`Не удалось найти категорию ${category.name}`);
    }

    for (const name of names) {
      participantsPayload.push({
        raceId: race.id,
        bib: bib++,
        name,
        categoryId,
      });
    }
  }

  await prisma.participant.createMany({ data: participantsPayload });

  console.log(
    `✅  Гонка "${race.name}" создана. Категорий: ${categories.length}, участников: ${participantsPayload.length}.`,
  );
}

async function main() {
  await seedRace();
}

main()
  .catch((error) => {
    console.error("❌  Ошибка при наполнении демо-данными", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
