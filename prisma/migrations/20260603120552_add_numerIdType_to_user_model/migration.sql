/*
  Warnings:

  - Added the required column `numberIdType` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "NumberIdType" AS ENUM ('V', 'E', 'P', 'J');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "numberIdType" "NumberIdType" NOT NULL;
