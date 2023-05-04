import {MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex} from "typeorm";

export class addPeersHistory1683215673862 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'peers_history',
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
                        name: 'peer_id',
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

        await queryRunner.createIndex(
            'peers',
            new TableIndex({ columnNames: ['enode'] })
        );

        await queryRunner.createForeignKey(
            'peers_history',
            new TableForeignKey({
                columnNames: ['peer_id'],
                referencedColumnNames: ['id'],
                referencedTableName: 'peers',
                onDelete: 'CASCADE',
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
    }

}
