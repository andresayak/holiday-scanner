import {MigrationInterface, QueryRunner, Table, TableForeignKey} from "typeorm";

export class addPeersActive1683216666167 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'peers_active',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
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
                ],
            }),
            true);

        await queryRunner.createForeignKey(
            'peers_active',
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
