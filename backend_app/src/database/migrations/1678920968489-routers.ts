import {MigrationInterface, QueryRunner, Table, TableIndex} from "typeorm";

export class routers1678920968489 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'router',
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
                    },
                    {
                        name: 'weth',
                        type: 'varchar(66)',
                        isNullable: true
                    },
                    {
                        name: 'factory',
                        type: 'varchar(66)',
                        isNullable: true
                    },
                    {
                        name: 'network',
                        type: 'varchar(66)',
                    },
                ]
            }));
        await queryRunner.createIndex(
            'router',
            new TableIndex({ isUnique: true, columnNames: ['network', 'address'] })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
