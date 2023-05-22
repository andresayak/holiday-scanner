import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";

export class createValidatorsHistory1684757647836 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'validators_history',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'extra',
                        type: 'varchar(128)',
                        isNullable: true,
                    },
                    {
                        name: 'validator_id',
                        type: 'int',
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

        await queryRunner.createForeignKey(
            'validators_history',
            new TableForeignKey({
                columnNames: ['validator_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'validators',
                onDelete: 'CASCADE',
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
