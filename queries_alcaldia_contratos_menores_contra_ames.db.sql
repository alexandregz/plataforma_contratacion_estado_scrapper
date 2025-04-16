-- hai que converter os importes porque tenhen formato x.xxx,xx   (dous decimais e separan milleiros)

-- select adjudicatario, sum(cast(replace(replace(importe, '.', ''), ',', '.') as decimal)) as total from Alcaldia_contratos_menores group by Adjudicatario order by total desc limit 30;

-- query: numero de licitacions e despois ordea por importes
-- select adjudicatario, count(*) as total,  sum(cast(replace(replace(importe, '.', ''), ',', '.') as decimal)) as importe_sum from Alcaldia_contratos_menores group by Adjudicatario order by total desc limit 30;

-- query: maximos importes e despois ordea por numero de licitacions
select adjudicatario, count(*) as total,  sum(cast(replace(replace(importe, '.', ''), ',', '.') as decimal)) as importe_sum from Alcaldia_contratos_menores group by Adjudicatario order by importe_sum desc, total desc limit 30;


-- select Adjudicatario, sum(cast(replace(replace(importe, '.', ''), ',', '.') as decimal)) as total from Alcaldia_contratos_menores where adjudicatario like '%marcas viarias%' group by adjudicatario

-- select * from Alcaldia_contratos_menores where adjudicatario like '%marcas viarias%'


