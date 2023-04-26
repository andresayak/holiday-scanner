import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class addPeers1682526959466 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name: 'peers',
                columns: [
                    {
                        name: 'id',
                        type: 'int',
                        isPrimary: true,
                        isGenerated: true,
                        generationStrategy: 'increment',
                    },
                    {
                        name: 'ip_address',
                        type: 'varchar(66)',
                    },
                    {
                        name: 'port',
                        type: 'varchar(32)',
                        isNullable: true,
                    },
                    {
                        name: 'country',
                        type: 'varchar(32)',
                        isNullable: true,
                    },
                    {
                        name: 'region',
                        type: 'varchar(32)',
                        isNullable: true,
                    },
                    {
                        name: 'city',
                        type: 'varchar(100)',
                        isNullable: true,
                    },
                    {
                        name: 'latitude',
                        type: 'varchar(32)',
                        isNullable: true,
                    },
                    {
                        name: 'longitude',
                        type: 'varchar(32)',
                        isNullable: true,
                    },
                    {
                        name: 'ping',
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
