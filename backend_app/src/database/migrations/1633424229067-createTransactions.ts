import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class createTransactions1633424229067 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'tokens',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'address',
                        type: 'varchar(66)',
                        isUnique: true
                    },
                ]
            }));

        await queryRunner.createTable(
            new Table({
                name: 'pairs',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'address',
                        type: 'varchar(66)',
                        isUnique: true
                    },
                    {
                        name: 'factory',
                        type: 'varchar(42)',
                        isNullable: true,
                    },
                    {
                        name: 'token0',
                        type: 'varchar(42)',
                        isNullable: true,
                    },
                    {
                        name: 'token1',
                        type: 'varchar(42)',
                        isNullable: true,
                    },
                    {
                        name: 'reserve0',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'reserve1',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'blockNumber',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: 'transactionIndex',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: 'logIndex',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                ]
            }));

        await queryRunner.createTable(
            new Table({
                name: 'transactions',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'hash',
                        type: 'varchar(66)',
                        isUnique: true
                    },
                    {
                        name: 'blockNumber',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: 'transactionIndex',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: 'from',
                        type: 'varchar(42)',
                        isNullable: true,
                    },
                    {
                        name: 'to',
                        type: 'varchar(42)',
                        isNullable: true,
                    },
                    {
                        name: 'gasPrice',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'gasUsed',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'gasLimit',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'value',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'data',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'nonce',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: 'chainId',
                        type: 'int',
                        isNullable: true,
                    },
                    {
                        name: 'status',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: 'type',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: 'pairAddress',
                        type: 'varchar(42)',
                        isNullable: true,
                    },
                    {
                        name: 'maxAmount',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'maxAmountUsd',
                        type: 'decimal(11,2)',
                        isNullable: true,
                    },
                    {
                        name: 'profit',
                        type: 'decimal(11,2)',
                        isNullable: true,
                    },
                    {
                        name: 'method',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'reserves0',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'reserves1',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'reservesAfter0',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'reservesAfter1',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'reservesAfter0estimate',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'reservesAfter1estimate',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'token0',
                        type: 'varchar(42)',
                        isNullable: true,
                    },
                    {
                        name: 'token1',
                        type: 'varchar(42)',
                        isNullable: true,
                    },
                    {
                        name: 'amount0',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'amount1',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'amount0Usd',
                        type: 'decimal(11,2)',
                        isNullable: true,
                    },
                    {
                        name: 'amount1Usd',
                        type: 'decimal(11,2)',
                        isNullable: true,
                    },
                ],
            }),
            true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
