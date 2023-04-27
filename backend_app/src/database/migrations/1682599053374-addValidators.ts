import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class addValidators1682599053374 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'validators',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'name',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'extra',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'address',
                        type: 'varchar(64)',
                        isNullable: true,
                        isUnique: true
                    },
                    {
                        name: 'lastBlock',
                        type: 'int',
                        unsigned: true,
                        isNullable: true,
                    },
                    {
                        name: 'created_at',
                        type: 'timestamp',
                        default: 'now()',
                    },
                    {
                        name: 'updated_at',
                        type: 'timestamp',
                        isNullable: true,
                    },
                ],
            }),
            true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
